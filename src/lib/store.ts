/**
 * App state. Plain module-level signals — the app is one screen with two steps,
 * no router/state library needed.
 *
 * Nothing about the photograph is ever written to storage, and nothing is uploaded: a
 * refresh means a fresh start, with no data URL in localStorage, no preview in
 * sessionStorage, nothing to find later. Only preferences are kept — language, hints, how
 * suggestions are computed, how wide a sample is — because those say nothing about the
 * picture.
 */
import { createEffect, createSignal, untrack } from 'solid-js';
import { hexToHsl } from './color.ts';
import type { HarmonyType, RetargetMode } from './harmonies.ts';
import { NEUTRAL_FLOOR } from './harmonies.ts';
import { readImageFile, sampler } from './image.ts';

export type Sample = {
  /** stable id — survives deletes, so "c5 shift toward orange" never changes meaning */
  id: string;
  label: string;
  hex: string;
  /** normalised 0..1 position over the photo */
  x: number;
  y: number;
  locked: boolean;
  ignored: boolean;
};

export type Tab = 'natural' | 'pure' | 'guide';
export type Step = 'sample' | 'harmony';

const PREFS_KEY = 'colorlab.prefs.v1';
/*
  The floor is the analysis floor (`canAnalyze`) on purpose: pressing Suggest must never leave
  the button grey. The ceiling is where a second glance at the frame stops paying for itself.
*/
const MIN_SAMPLES = 4;
/** The most the suggester will ever place: past this the points stop being decisions. */
const SUGGEST_MAX = 8;

let seq = 0;
const nextId = (): string => {
  let id: string;
  do { id = `c${++seq}`; } while (samples().some((s) => s.id === id));
  return id;
};

const [photo, setPhoto] = createSignal<Photo | null>(null);
const [samples, setSamples] = createSignal<Sample[]>([]);
const [selected, setSelected] = createSignal<string | null>(null);
const [step, setStep] = createSignal<Step>('sample');
const [tab, setTab] = createSignal<Tab>('guide');   // step 02 opens on the harmony skeleton
const [harmony, setHarmony] = createSignal<HarmonyType | 'auto'>('auto');
const [neutralFloor, setNeutralFloor] = createSignal(NEUTRAL_FLOOR);
const [showHints, setShowHints] = createSignal(true);
/** how a suggested colour is computed once the target hue is known — see harmonies.ts */
const [retargetMode, setRetargetMode] = createSignal<'hue' | 'relative'>('relative');
const [customHue, setCustomHue] = createSignal<Record<string, number>>({});
const [prominence, setProminence] = createSignal<Record<string, number>>({});
/** Sample area side length, in working-canvas pixels: Photoshop's sizes, plus 32. */
export type SampleSize = 3 | 5 | 9 | 16 | 32;
export const SAMPLE_SIZES: SampleSize[] = [3, 5, 9, 16, 32];
export type Photo = { src: string; name: string; w: number; h: number };

const [sampleSize, setSampleSize] = createSignal<SampleSize>(5);
/**
 * The decoded bitmap behind a photo lives in image.ts, not here. Sampling is impossible
 * until it matches the current photo — which is exactly what happens after a reload, where
 * the <img> shows up from the data URL while the sampler is still empty.
 */
const [pixelsSrc, setPixelsSrc] = createSignal<string | null>(null);

/**
 * The photo that arrived on top of existing sample points — i.e. a re-analysis, the
 * screenshot back from the editor rather than a first look at the scene. Worth remembering,
 * because a graded render is the point of that round trip, not a mistake to warn about.
 */
const [reanalysis, setReanalysis] = createSignal<string | null>(null);

const history: Sample[][] = [];

function snapshot() {
  history.push(samples().map((s) => ({ ...s })));
  if (history.length > 60) history.shift();
}

/** true once the sampler holds the pixels of the current photo — clicking needs this */
export const pixelsReady = (): boolean => pixelsSrc() !== null && pixelsSrc() === photo()?.src;

/**
 * Make a file the working photo, from the upload card, a drop on the canvas or a paste.
 *
 * It deliberately does not touch the samples. Dropping the frame back from Photoshop is the
 * same workflow as pasting it: the points stay where they are and the effect watching
 * `pixelsSrc` re-reads each one from the new picture.
 */
export async function loadFile(file: File | undefined | null): Promise<void> {
  if (!file) return;
  const loaded = await readImageFile(file);   // throws before anything is replaced if it is not a readable image
  setPhoto(loaded);
}

/**
 * A new photo under existing points: their places still mean something — that is the whole
 * point of pasting the retouched version of the same frame — but the colours they carry
 * came from the previous file. So the locations stay and the readings are taken again.
 *
 * Reads are untracked: this runs from an effect watching the pixels, and it writes samples
 * itself, which would otherwise make that effect depend on what it changes.
 */
export function resampleAll(): void {
  untrack(() => {
    if (!pixelsReady() || !samples().length) return;
    setReanalysis(photo()?.src ?? null);
    snapshot();
    setSamples(samples().map((s) => {
      const p = sampler.clampToSample(s.x, s.y, sampleSize());
      const hex = sampler.sampleAt(p.u, p.v, sampleSize());
      return hex ? { ...s, hex, x: p.u, y: p.v } : { ...s, x: p.u, y: p.v };
    }));
  });
}

/**
 * A batch that arrived together should undo as one thing: eight suggested points are one
 * ⌘Z, not eight presses. `addSample` exists for the click path, where each dot genuinely
 * is its own decision.
 */
export function addSamples(list: { hex: string; x: number; y: number }[]): void {
  if (!list.length) return;
  snapshot();
  const made = list.map((p) => ({ id: nextId(), label: '', hex: p.hex, x: p.x, y: p.y, locked: false, ignored: false }));
  setSamples((prev) => [...prev, ...made]);
  setSelected(made[made.length - 1].id);
}

/**
 * The number the user sees: the sample's position in the list, so the numbers are always
 * 1…n with no gaps. Delete the first of six and the rest close up to 1–5; the next point
 * added is 6.
 *
 * The internal id keeps whatever it was. `prominence`, `customHue`, `selected` and the undo
 * history all key on it, and rewriting those keys to make a label look tidy is how a dot
 * ends up pointing at somebody else's colour.
 */
export const sampleNumber = (id: string): number => samples().findIndex((s) => s.id === id) + 1;

export function undo() {
  const prev = history.pop();
  if (prev) setSamples(prev);
}

export function addSample(hex: string, x: number, y: number): string {
  snapshot();
  const s: Sample = { id: nextId(), label: '', hex, x, y, locked: false, ignored: false };
  setSamples((p) => [...p, s]);
  setSelected(s.id);
  return s.id;
}

export function updateSample(id: string, patch: Partial<Sample>, snap = true) {
  if (snap) snapshot();
  setSamples((p) => p.map((s) => (s.id === id ? { ...s, ...patch } : s)));
}

export function removeSample(id: string) {
  snapshot();
  setSamples((p) => p.filter((s) => s.id !== id));
  if (selected() === id) setSelected(null);
}

/**
 * Put a sample somewhere else in the list.
 *
 * The order IS the numbers, so this is the one action that renumbers: the row, the dot on the
 * photograph and the chip on the wheel all read `sampleNumber`, and they move together. This
 * is also why the ids stay put — `prominence`, `customHue`, `selected` and the undo history
 * all key on the id, and a re-sort is none of their business.
 *
 * `to` is the index in the list *after* the moved sample has been lifted out of it, which is
 * what a caller computing a drop position wants: "put it between these two".
 */
export function moveSample(id: string, to: number): void {
  const list = samples();
  const from = list.findIndex((s) => s.id === id);
  if (from < 0) return;
  const dest = Math.max(0, Math.min(list.length - 1, to));
  if (from === dest) return;
  snapshot();
  const next = list.slice();
  const [moved] = next.splice(from, 1);
  next.splice(dest, 0, moved);
  setSamples(next);
}

export function clearAll(keepPhoto = true) {
  snapshot();
  setSamples([]);
  setCustomHue({});
  if (!keepPhoto) { setPhoto(null); setProminence({}); }
}

export function canAnalyze(): boolean { return samples().length >= MIN_SAMPLES; }
export { MIN_SAMPLES, SUGGEST_MAX, samples, photo, selected, step, tab, harmony,
  neutralFloor, showHints, customHue, prominence, setStep, setTab, setHarmony, setSelected,
  setPhoto, setNeutralFloor, setShowHints, setCustomHue, setProminence,
  retargetMode, setRetargetMode, pixelsSrc, setPixelsSrc, setSamples,
  sampleSize, setSampleSize, reanalysis };

/**
 * Samples enriched with HSL and a plotting hue.
 *
 * `hue` is what the colour measures, and it stays that way. In Custom mode the hue someone
 * drags to is kept in `custom`, beside it, never on top of it: a dot drawn at a hue it does
 * not have is the canvas lying about a photograph, which is the one thing this tool is not
 * allowed to do. Anything scoring the *intended* palette reads `custom ?? hue`.
 *
 * Plain derivations, not module-level memos: actions can be dispatched from outside
 * a reactive root (a click handler, the smoke test), and an unowned memo would not
 * be guaranteed to refresh there.
 */
export function dots() {
  const ch = customHue();
  const pr = prominence();
  return samples().map((s) => {
    const hsl = hexToHsl(s.hex);
    return { ...s, hsl, hue: hsl.h, custom: ch[s.id], weightBoost: pr[s.id] ?? 0 };
  });
}

/** Take one hand-placed target back: the dot is left with the colour it actually measured. */
export function clearCustomHue(id: string): void {
  setCustomHue((prev) => {
    if (prev[id] === undefined) return prev;
    const next = { ...prev };
    delete next[id];
    return next;
  });
}

/** lightness-band coverage, in the spirit of "sample highlights and shadows too" */
export function coverage() {
  const bands = { shadows: 0, midtones: 0, highlights: 0 };
  for (const d of dots()) {
    if (d.hsl.l < 33) bands.shadows++;
    else if (d.hsl.l > 67) bands.highlights++;
    else bands.midtones++;
  }
  return bands;
}

/* ---------------------------------------------------------------- persistence */

/** Preferences only. Small, and they say nothing about the photograph. */
type Prefs = {
  v: 1; hints: boolean; floor: number; mode: RetargetMode; size: SampleSize;
};

function save(): void {
  const prefs: Prefs = {
    v: 1, hints: showHints(), floor: neutralFloor(), mode: retargetMode(), size: sampleSize(),
  };
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* private mode */ }
}

export function restore(): void {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    const prefs = raw ? (JSON.parse(raw) as Prefs) : null;
    if (prefs && prefs.v === 1) {
      if (typeof prefs.hints === 'boolean') setShowHints(prefs.hints);
      if (typeof prefs.floor === 'number') setNeutralFloor(prefs.floor);
      if (prefs.mode === 'hue' || prefs.mode === 'relative') setRetargetMode(prefs.mode);
      if (SAMPLE_SIZES.includes(prefs.size)) setSampleSize(prefs.size);
    }
  } catch { /* private mode or corrupted JSON — preferences are not worth a failure */ }
}

/** Call once from inside the component tree so the persistence effect has an owner. */
export function initStore() {
  restore();
  // Preferences only, and only when one of them actually changes: a photograph, a sample
  // list or a step is never written anywhere, so there is nothing to debounce.
  createEffect(() => {
    showHints(); neutralFloor(); retargetMode(); sampleSize();
    save();
  });
}
