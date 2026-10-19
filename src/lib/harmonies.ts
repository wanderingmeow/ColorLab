/**
 * Harmony engine.
 *
 * Reverse-engineered from the reference screenshots (see tests/harmony.test.ts):
 *   - Split-Complementary slots are {b, b+150, b+210} — i.e. base + the two colours
 *     adjacent to its complement. For the reference photo the fit lands on b = 240,
 *     giving slots 240 / 30 / 90 = "blue · orange · yellow-green", which is exactly
 *     what the original UI reports, and it reproduces its three suggested hexes
 *     (c1 -> #747476, c5 -> #908F8E, c6 -> #BAC5AF).
 *   - Analogous is a 60° window: dots inside (or within tolerance of an edge) are
 *     "Aligned", dots outside are nudged to the nearest edge.
 *   - The anchor is fitted by scanning every 1° and minimising weighted drift.
 */
import {
  addHue, chromaRatio, deltaE, hueDelta, hueDist, hueName, retarget, retargetRelative,
} from './color.ts';

/** `t` from src/i18n — kept as a parameter so this module stays locale-free. */
export type Translate = (key: string, args?: Record<string, string | number | boolean>) => string;

export type HarmonyType =
  | 'split-complementary' | 'double-split-complementary' | 'tetradic' | 'rectangle'
  | 'analogous' | 'complementary' | 'triadic' | 'monochromatic' | 'custom';

/** Within this many degrees of a slot a dot counts as Aligned. */
export const TOLERANCE = 15;
/** Analogous is a window rather than a set of arms: this many degrees wide. */

/** Analogous is a window rather than a set of arms: this many degrees wide. */
export const ANALOGOUS_WINDOW = 60;

type HarmonyDef = {
  /** arm angles relative to the anchor; empty for a window and for a hand-drawn skeleton */
  offsets: number[];
  /**
   * How many hues this harmony is made of — the promise the finished result has to keep.
   *
   * A square is four colours. Sample one yellow in four places and the maths still finds a
   * square that fits perfectly: every dot on a slot, zero drift, a score near 100. It is a
   * monochromatic palette wearing a square's name, and the coverage term in the score
   * (15% of it) is not a refusal. `minArms()` and `staffable()` turn this number into a gate.
   */
  arms: number;
  /**
   * Whether the tool may pick this one *for* you.
   *
   * `rectangle` and `double-split-complementary` are offered by hand only, and not out of
   * nostalgia: a skeleton with more slots is more likely to have one near every dot, so a
   * four-arm scheme outscores a three-arm one on drift almost by construction (on the
   * reference photograph, 95 against 86). Letting them into the automatic ranking would
   * tilt every photograph toward the loudest scheme available — a scoring artefact wearing
   * a colour-theory costume. They stay selectable, with their real score next to them.
   */
  auto: boolean;
  /** analogous only: the width of the window it accepts */
  window?: number;
};

/**
 * One row per harmony. Everything the app needs to know about a harmony lives here.
 *
 * This table exists because a new harmony used to mean ten edits in five files — the union,
 * the order, the labels, the offsets, the arm count, the auto-detect exclusion, the picker
 * glyph, three dictionary keys in two locales, and a test expectation — and forgetting any
 * one of them was silent: the glyph crashed, the auto-detect quietly volunteered a scheme
 * it should not have, the UI printed `harmonyFeeling.long.rectangle`.
 *
 * `satisfies Record<HarmonyType, HarmonyDef>` is the point: add a name to `HarmonyType` and
 * nothing compiles until the row exists. The glyph, the order, the arm count and the
 * automatic set are all derived, so they cannot disagree with the table.
 */
const HARMONIES: Record<HarmonyType, HarmonyDef> = {
  'split-complementary': { offsets: [0, 150, 210], arms: 3, auto: true },
  // three four-armed harmonies, separated by how wide the rectangle is
  'double-split-complementary': { offsets: [0, 30, 180, 210], arms: 4, auto: false },
  'tetradic': { offsets: [0, 90, 180, 270], arms: 4, auto: true },
  'rectangle': { offsets: [0, 60, 180, 240], arms: 4, auto: false },
  'analogous': { offsets: [], arms: 2, auto: true, window: ANALOGOUS_WINDOW },
  'complementary': { offsets: [0, 180], arms: 2, auto: true },
  'triadic': { offsets: [0, 120, 240], arms: 3, auto: true },
  'monochromatic': { offsets: [0], arms: 1, auto: true },
  // the user draws this skeleton; it is legal by construction and never detected
  'custom': { offsets: [], arms: 0, auto: false },
};

/** picker order, and the tie-break order of the ranking */
export const HARMONY_ORDER = Object.keys(HARMONIES) as HarmonyType[];

/** arm angles relative to the anchor, for the harmonies that have slots */
export const OFFSETS = Object.fromEntries(
  HARMONY_ORDER.filter((t) => HARMONIES[t].offsets.length > 0)
    .map((t) => [t, HARMONIES[t].offsets]),
) as Record<Exclude<HarmonyType, 'analogous' | 'custom'>, number[]>;

/** how many hues each harmony is made of */
export const ARMS = Object.fromEntries(
  HARMONY_ORDER.map((t) => [t, HARMONIES[t].arms]),
) as Record<HarmonyType, number>;

/** the set the tool is allowed to pick for you — see `HarmonyDef.auto` */
export const AUTO_DETECT = HARMONY_ORDER.filter((t) => HARMONIES[t].auto);

/** dots on a circle for the picker glyph; a window draws its two edges and its centre */
export function glyphAngles(type: HarmonyType): number[] {
  const def = HARMONIES[type];
  return def.window ? [-def.window / 2, 0, def.window / 2] : [...def.offsets];
}

/**
 * How many distinct hues before a harmony is worth offering: one arm short is fine, because
 * the missing arm is exactly what a suggestion is for — three hues plus one move is a square
 * you can actually build. Two arms short is not a harmony to reach for, it is a palette to
 * invent, and the tool would be recommending you repaint most of the photograph.
 */
export const minArms = (type: HarmonyType): number => Math.max(0, ARMS[type] - 1);

/**
 * Can this set of samples actually carry this harmony?
 *
 * Two separate questions, and the second is the one that matters at the end:
 *  - `arms`: do you roughly have the harmony already (one arm may be a move away)?
 *  - `dots`: do you have enough colours left to *stand* on every arm? Four arms need four
 *    dots; three dots can never become four hues, no matter what the sliders say.
 * The promise is on the way out, not on the way in: a square you finish with is four hues.
 */
export function staffable(type: HarmonyType, dots: FitDot[]): {
  ok: boolean; reason: 'arms' | 'dots' | null;
  need: number; have: number; slots: number; dots: number;
} {
  const active = dots.filter((d) => !d.ignored);
  const have = armCount(active);
  const slots = ARMS[type];
  const need = minArms(type);
  if (have < need) return { ok: false, reason: 'arms', need, have, slots, dots: active.length };
  if (active.length < slots) return { ok: false, reason: 'dots', need, have, slots, dots: active.length };
  return { ok: true, reason: null, need, have, slots, dots: active.length };
}

/**
 * Distinct hue groups on a circle. Neighbours within `tol` merge, including across 0°, so a
 * chain of hues each close to the next counts as one group rather than four.
 */
export function hueGroups(hues: number[], tol = TOLERANCE): number {
  const hs = [...new Set(hues.map((h) => ((h % 360) + 360) % 360))].sort((a, b) => a - b);
  if (hs.length < 2) return hs.length;
  let groups = 1;
  for (let i = 1; i < hs.length; i++) if (hs[i] - hs[i - 1] > tol) groups++;
  if (groups > 1 && 360 - hs[hs.length - 1] + hs[0] <= tol) groups--;
  return groups;
}

/**
 * How many arms this set of dots can actually staff. Neutrals are not counted — a grey has no
 * trustworthy hue, and "grey + orange" is not a complementary pair. A frame with nothing
 * chromatic still counts as one group, so monochromatic stays available and nobody is left
 * with a panel of disabled buttons.
 */
export function armCount(dots: FitDot[]): number {
  const active = dots.filter((d) => !d.ignored);
  const chromatic = active.filter((d) => chromaRatio(d.hex) >= NEUTRAL_FLOOR).map((d) => d.hue);
  return chromatic.length ? hueGroups(chromatic) : (active.length ? 1 : 0);
}
/** Drift beyond this is not punished further when scoring. */
const DRIFT_CAP = 120;
/** Snap the fitted anchor, like the reference tool does (238 -> 240). */
const ANCHOR_SNAP = 10;
/** chromaRatio below this = "grey": its hue is not trustworthy. */
export const NEUTRAL_FLOOR = 0.06;
/** Below this OKLab distance two colours are the same colour to a human eye. */
export const JND = 1;

/**
 * How a suggested colour is chosen once the target hue is known.
 *  - `hue`:      keep HSL S and L — literally what the reference tool prints
 *  - `relative`: keep OKLab lightness and relative chroma, so the colour stays as loud
 *                at the destination hue as it was at the source
 */
export type RetargetMode = 'hue' | 'relative';

export type FitDot = {
  id: string; hex: string; hue: number;
  weight?: number; ignored?: boolean;
  /** anchors the harmony skeleton onto this hue */
  locked?: boolean;
};
export type Suggestion = {
  id: string;
  /** `inert` = the move exists in hue space but nobody can see it — see JND */
  kind: 'aligned' | 'shift' | 'ignored' | 'inert' | 'locked';
  /** degrees, signed (+ = hue increases) */
  delta?: number;
  targetHue?: number;
  targetHex?: string;
  deltaE?: number;
  magnitude?: 'small' | 'big';
  /** hue is not trustworthy at this chroma */
  neutral?: boolean;
  /** this move is the one that opens an arm nobody was standing on */
  fillsEmpty?: boolean;
};
export type Fit = {
  type: HarmonyType;
  anchor: number;
  slots: number[];
  /** window start, analogous only */
  window?: [number, number];
  score: number;
  coverage: number;
  /** whether these samples can carry this harmony at all — see `staffable()` */
  arms: ReturnType<typeof staffable>;
  driftMean: number;
  driftMax: { id: string; value: number } | null;
  suggestions: Suggestion[];
  /** hue bucket keys, e.g. ['blue','orange','yellow-green'] — render with `hueBucket()` */
  builtAround: string[];
};

export function defaultWeight(hex: string): number {
  // Chroma-dominant: a 1%-saturation grey should not drag the harmony around.
  return 0.35 + Math.pow(chromaRatio(hex), 0.75) * 3;
}

function distanceToSlots(hue: number, slots: number[]): { dist: number; edge: number } {
  let best = { dist: Infinity, edge: slots[0] };
  for (const s of slots) {
    const d = hueDist(hue, s);
    if (d < best.dist) best = { dist: d, edge: s };
  }
  return best;
}

/**
 * How close counts as "on this arm", for this skeleton.
 *
 * A fixed 15° is right for a complementary or a triad, but double-split-complementary puts
 * its arms 30° apart: with a 15° tolerance every hue on the wheel would be "on an arm", the
 * tool would call everything aligned and the harmony would do nothing at all. Tolerance is
 * therefore capped at a third of the narrowest gap, so arms always leave real space between
 * them — and nothing else changes, because 15° is already below a third of every other
 * skeleton's gap.
 */
export function armTolerance(slots: number[]): number {
  let gap = 360;
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) gap = Math.min(gap, hueDist(slots[i], slots[j]));
  }
  return Math.min(TOLERANCE, Math.floor(gap / 3));
}

/**
 * Which slot each dot is asked to stand on.
 *
 * Everyone starts on their nearest slot. An arm nobody occupies is then filled by taking the
 * cheapest duplicate from an arm that can spare one — because a square you end with three
 * hues in is not a square. The tool has to name which of your colours opens the empty arm
 * instead of printing a slot nobody walks to. An arm is never emptied to fill another, and a
 * locked colour is never the one asked to go.
 */
function assignSlots(active: FitDot[], slots: number[]): Map<string, number> {
  const home = new Map<string, number>();
  const arms = new Map<number, FitDot[]>();
  for (const d of active) {
    const s = distanceToSlots(d.hue, slots).edge;
    home.set(d.id, s);
    arms.set(s, [...(arms.get(s) ?? []), d]);
  }
  for (const s of slots) {
    if (arms.get(s)?.length) continue;
    let best: { d: FitDot; from: number; cost: number } | null = null;
    for (const [arm, ds] of arms) {
      if (ds.length < 2) continue;
      for (const d of ds) {
        if (d.locked) continue;
        const cost = hueDist(d.hue, s);
        if (!best || cost < best.cost) best = { d, from: arm, cost };
      }
    }
    if (!best) break;
    const donor = best.d;
    arms.set(best.from, arms.get(best.from)!.filter((x) => x.id !== donor.id));
    arms.set(s, [...(arms.get(s) ?? []), donor]);
    home.set(donor.id, s);
  }
  return home;
}

function distanceToWindow(hue: number, start: number, width: number): { dist: number; edge: number } {
  const rel = (((hue - start) % 360) + 360) % 360;
  if (rel <= width) return { dist: 0, edge: start + rel };
  const toEnd = rel - width;      // walk forward to the far edge
  const toStart = 360 - rel;      // walk backward to the near edge
  return toEnd <= toStart
    ? { dist: toEnd, edge: addHue(start, width) }
    : { dist: toStart, edge: start };
}

function geometry(type: HarmonyType, anchor: number): Geometry {
  const def = HARMONIES[type];
  if (def.window) {
    const end = addHue(anchor, def.window);
    return { slots: [anchor, end], window: [anchor, end] };
  }
  return { slots: def.offsets.map((o) => addHue(anchor, o)) };
}

/**
 * Fit one harmony to a set of dots: find the anchor, put everybody on an arm, then say what
 * each dot has to do about it. Every step is a separate function because each one is a
 * different kind of decision — where to stand, who moves, how far it is, whether the name
 * is still true at the end.
 */
/** A skeleton placed on the wheel: the arms to stand on, or the window to fall inside. */
type Geometry = { slots: number[]; window?: [number, number] };

/** How far a hue sits from the skeleton it is being fitted to, and which arm is nearest. */
function near(hue: number, g: Geometry): { dist: number; edge: number } {
  return g.window
    ? distanceToWindow(hue, g.window[0], ANALOGOUS_WINDOW)
    : distanceToSlots(hue, g.slots);
}

/**
 * Rotate the skeleton to the angle that asks the least of the photograph.
 *
 * A locked dot is not a heavy opinion, it is a constraint: the search is restricted to the
 * anchors that put one of its arms on that dot, and only the remaining dots are allowed to
 * be asked to move. With no locks, every whole degree is tried and the winner is snapped to
 * a tidy 10°, because an anchor of 238° is a reading error pretending to be a measurement.
 */
function chooseAnchor(type: HarmonyType, active: FitDot[], w: number[]): number {
  if (type === 'custom') return active[0]?.hue ?? 0;

  const locked = active.filter((d) => d.locked).map((d) => d.hue);
  let candidates: number[] | null = null;
  if (locked.length) {
    candidates = [];
    const def = HARMONIES[type];
    const offs = def.window ? [0, -def.window, -def.window / 2] : def.offsets;
    for (const h of locked) for (const o of offs) candidates.push(((h - o) % 360 + 360) % 360);
  }

  const scan = candidates ?? Array.from({ length: 360 }, (_, i) => i);
  let anchor = 0, bestCost = Infinity;
  for (const a of scan) {
    const g = geometry(type, a);
    let cost = 0;
    active.forEach((d, i) => {
      const dist = near(d.hue, g).dist;
      cost += w[i] * Math.min(dist, DRIFT_CAP);
      // a locked dot that is off the arms means the locks contradict each other; the fit
      // still has to pick a side, and it should pick the one that offends them least
      if (d.locked) cost += Math.min(dist, DRIFT_CAP) * 12;
    });
    if (cost < bestCost - 1e-9) { bestCost = cost; anchor = a; }
  }
  // a lock-determined anchor is somebody's actual colour: rounding it would invent a hue
  return candidates ? anchor : (Math.round(anchor / ANCHOR_SNAP) * ANCHOR_SNAP) % 360;
}

/**
 * What to tell one dot to do.
 *
 * The order of these checks is the product: an ignored dot gets nothing, a dot already on
 * its arm gets nothing, a locked dot is never told to move, and a move too small to see is
 * reported as too small rather than as advice.
 */
function planDot(
  d: FitDot, g: Geometry, tol: number, home: Map<string, number> | null, mode: RetargetMode,
): Suggestion {
  if (d.ignored) return { id: d.id, kind: 'ignored' };
  const neutral = chromaRatio(d.hex) < NEUTRAL_FLOOR;
  // where this dot is asked to stand: its nearest arm, or the empty arm it was picked to open
  const slot = home?.get(d.id) ?? near(d.hue, g).edge;
  const dist = home && home.has(d.id) ? hueDist(d.hue, slot) : near(d.hue, g).dist;
  const fillsEmpty = home && home.get(d.id) !== near(d.hue, g).edge ? true : undefined;
  if (dist <= tol) return { id: d.id, kind: 'aligned', neutral };

  // A locked dot is the reason the skeleton sits where it sits. If it still ends up off the
  // slots, the locks contradict each other — and asking someone to move the colour they
  // pinned is a contradiction, not advice.
  const targetHue = Math.round(((slot % 360) + 360) % 360) % 360;
  if (d.locked) return { id: d.id, kind: 'locked', neutral, delta: hueDelta(d.hue, slot), targetHue };

  const targetHex = mode === 'relative' ? retargetRelative(d.hex, targetHue) : retarget(d.hex, targetHue);
  const de = deltaE(d.hex, targetHex);
  // A move under the just-noticeable difference is not advice: it is arithmetic noise (a
  // 1%-saturation grey rotated 20° comes back as the very same 8-bit colour), and it asks
  // someone to open a slider for nothing. Say what to do instead.
  if (de < JND) {
    return { id: d.id, kind: 'inert', neutral, delta: hueDelta(d.hue, targetHue), targetHue, deltaE: de, fillsEmpty };
  }
  return {
    id: d.id, kind: 'shift', neutral,
    delta: hueDelta(d.hue, targetHue),
    targetHue, targetHex, deltaE: de,
    magnitude: de >= 3 ? 'big' : 'small',
    fillsEmpty,
  };
}

/** How far the dots have to travel, weighted by how much of the frame each one speaks for. */
function measureDrift(active: FitDot[], w: number[], g: Geometry) {
  const total = w.reduce((a, b) => a + b, 0) || 1;
  let sum = 0, max = 0, id = '';
  active.forEach((d, i) => {
    const dist = near(d.hue, g).dist;
    sum += w[i] * Math.min(dist, DRIFT_CAP);
    if (dist > max) { max = dist; id = d.id; }
  });
  return { mean: sum / total, max: id ? { id, value: max } : null };
}

/** How much of the skeleton somebody is actually standing on. */
function slotCoverage(type: HarmonyType, g: Geometry, active: FitDot[], tol: number): number {
  // a window or a single arm is satisfied by the dots being there at all
  if (type === 'analogous' || type === 'monochromatic') return active.length ? 1 : 0;
  const slots = g.window ? g.window : g.slots;
  if (!slots.length) return 0;
  return slots.filter((s) => active.some((d) => hueDist(d.hue, s) <= tol)).length / slots.length;
}

export function fit(type: HarmonyType, dots: FitDot[], mode: RetargetMode = 'hue'): Fit {
  const active = dots.filter((d) => !d.ignored);
  const w = active.map((d) => d.weight ?? defaultWeight(d.hex));

  const anchor = chooseAnchor(type, active, w);
  const g = geometry(type, anchor);
  const tol = armTolerance(g.slots);
  // an arm nobody stands on is filled by a duplicate, so the answer really is the harmony
  const home = g.window || g.slots.length < 2 ? null : assignSlots(active, g.slots);

  const drift = measureDrift(active, w, g);
  const coverage = slotCoverage(type, g, active, tol);
  const arms = staffable(type, active);
  // score = how little the dots have to move + how completely the slots are filled
  const score = type === 'custom'
    ? 0
    : Math.round(100 * (1 - drift.mean / DRIFT_CAP) * (0.85 + 0.15 * coverage));

  return {
    type, anchor, slots: g.slots, window: g.window,
    suggestions: dots.map((d) => planDot(d, g, tol, home, mode)),
    // not a matter of degree: a square made of one hue is not a weaker square, it is not a square
    score: arms.ok ? Math.max(0, Math.min(100, score)) : 0,
    coverage, arms, driftMean: drift.mean, driftMax: drift.max,
    builtAround: [...new Set(g.slots.map((s) => hueName(s)))],
  };
}

export function detect(dots: FitDot[], mode: RetargetMode = 'hue'): Fit[] {
  return AUTO_DETECT
    .map((t) => fit(t, dots, mode))
    .filter((f) => f.arms.ok)
    .sort((a, b) => b.score - a.score);
}

/**
 * "Shift toward blue" / "Big shift toward yellow-green" — matching the reference wording.
 * The engine stays locale-free: callers hand it a translator (`t` from src/i18n).
 */
export function suggestionText(s: Suggestion, t: Translate): string {
  if (s.kind === 'aligned') return t('adj.aligned');
  if (s.kind === 'ignored') return t('adj.ignored');
  if (s.kind === 'inert') return t('adj.inert');
  if (s.kind === 'locked') return t('adj.locked');
  return t(s.magnitude === 'big' ? 'adj.bigShift' : 'adj.shift', {
    hue: t(`hue.${s.targetHue === undefined ? '' : hueName(s.targetHue)}`),
  });
}
