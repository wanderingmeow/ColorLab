import { AUTO_DETECT, defaultWeight, fit, HARMONY_ORDER } from './harmonies.ts';
import type { Fit, HarmonyType } from './harmonies.ts';
import { dots, harmony, prominence, retargetMode } from './store.ts';

export type FitDot = { id: string; hex: string; hue: number; weight: number; ignored: boolean; locked: boolean };

const ALL = HARMONY_ORDER.filter((t) => t !== 'custom');

export function fitDots(): FitDot[] {
  const pr = prominence();
  /*
   * An intent placed by dragging in Custom mode is a statement about Custom mode, and it
   * stops being one the moment you leave. Reading it into every harmony was a lie with two
   * faces: the wheel drew the dot at the colour it measured, while the skeleton — and every
   * suggestion computed from it — was anchored on a hue that colour had never had. The
   * reader was told to push the sky 62° to satisfy an arrangement left behind in another mode.
   */
  const honourIntent = harmony() === 'custom';
  return dots().map((d) => ({
    id: d.id, hex: d.hex,
    // in Custom mode the skeleton is drawn against where the colours are being taken to;
    // the dot itself still sits at the hue it measured
    hue: (honourIntent ? d.custom : undefined) ?? d.hue, ignored: d.ignored, locked: d.locked,
    // chroma keeps greys from dragging the skeleton around; area makes big shapes outvote details
    weight: defaultWeight(d.hex) * (1 + 2.5 * Math.min(0.5, pr[d.id] ?? 0)),
  }));
}

/**
 * Every harmony, scored. Cached against a signature of the inputs.
 *
 * A full scan is eight harmonies fitted over every anchor: about 20ms for a handful of
 * dots. The panel reads a score for each of its nine buttons, the wheel reads the detected
 * answer, and the read-out reads the top of the list — and a click that only changes *which
 * dot is selected* invalidates none of that. Recomputing it per read is how a hover stutters.
 *
 * A signature rather than a `createMemo`, because these functions are also called from event
 * handlers and from tests, outside any owner, where an unowned memo would compute once and
 * then lie forever.
 */
let cache: { key: string; all: Fit[] } | null = null;

function signature(dots: FitDot[], mode: string): string {
  return mode + '|' + dots.map((d) => `${d.hex}~${Math.round(d.hue)}~${d.ignored ? 1 : 0}~${d.locked ? 1 : 0}~${Math.round(d.weight)}`).join(',');
}

/** the eight scored fits, unstaffable ones included — the ranking is a view over these */
function allFits(): Fit[] {
  const ds = fitDots();
  const key = signature(ds, retargetMode());
  if (cache && cache.key === key) return cache.all;
  const all = ALL.map((t) => fit(t, ds, retargetMode()));
  cache = { key, all };
  return all;
}

/** every harmony scored, best first — including the ones the tool will not choose for you */
export function ranked(): Fit[] {
  // a harmony the photo cannot staff is not a weak candidate — it is not a candidate
  return allFits().filter((f) => f.arms.ok).sort((a, b) => b.score - a.score);
}

export function detected(): Fit | null {
  // the wider rectangle family is scored for comparison, never volunteered
  return ranked().find((f) => AUTO_DETECT.includes(f.type)) ?? null;
}

export function activeType(): HarmonyType {
  const h = harmony();
  if (h === 'custom') return 'custom';
  if (h === 'auto') return detected()?.type ?? 'split-complementary';
  return h;
}

export function activeFit(): Fit | null {
  const type = activeType();
  if (type === 'custom') return null;
  // the very object the ranking scored, so the panel and the wheel can never be reading
  // two fits that happened to be computed against different inputs
  return allFits().find((f) => f.type === type) ?? null;
}

export function isAuto(): boolean { return harmony() === 'auto'; }

/**
 * Custom mode read-out: what structure has the hand-placed set of targets landed on?
 *
 * It reads the same ranking the picker shows, unstaffable schemes included in the filter —
 * naming a tetradic over three identical dots would be the lie this app spends the rest of
 * its time refusing to tell.
 */
export function customReadout(): { type: HarmonyType; score: number } | null {
  const top = ranked()[0];
  return top ? { type: top.type, score: top.score } : null;
}
