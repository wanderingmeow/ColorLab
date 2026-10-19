import { hexToRgb, rgbToOklab } from './color.ts';

/**
 * The other axis: how far the sampled colours pull apart.
 *
 * Harmony and separation are not the same judgement, and the research says they run in
 * opposite directions. Preference for a colour pair and the harmony of a colour pair both rise
 * as the hues get *more similar*, and highly contrastive pairs are judged neither preferable nor
 * harmonious — while a figure colour is liked *more* the further it is pulled from its background
 * (Schloss & Palmer 2011, Attention, Perception, & Psychophysics 73:551-571). So this module
 * refuses to fold its numbers into the harmony score. Two readings, side by side, and the reader
 * decides which one they are after.
 *
 * Both are group readings over the sampled colours, measured in Oklab:
 *
 * - `warmCool` is the standard deviation of the b axis (blue-yellow). O'Donovan, Agarwala &
 *   Hertzmann (2011, ACM TOG 30(4) art63) found the standard deviation of the blue-yellow axis to
 *   be the single most positive feature in community-rated palettes. We measure it on Oklab's b,
 *   not CIELab's: same axis in spirit, different numbers, so do not compare the figure to theirs.
 * - `lightness` is the range of L across the samples — darkest sample to lightest sample.
 *   Schloss & Palmer found lightness contrast carrying more of pair preference than hue
 *   relationships do. Note what this is *not*: it is a spread across the samples, not a
 *   figure-versus-ground measurement, which is what the study actually ran.
 *
 * Both are normalised against a ceiling chosen on real frames, so readings stay comparable
 * between photos: all-grey is 0 on both, teal against orange is 82 warm-cool and 4 lightness,
 * black against white is 0 and 100. They are readings, not merit — 100 warm-cool with 0
 * lightness is no better than the reverse, and a photo does not need either.
 */

/** Oklab b standard deviation that reads as a fully separated warm/cool set. */
const B_CEILING = 0.1;
/** Oklab L range that reads as a fully separated light/dark set. */
const L_CEILING = 0.7;

export type Separation = {
  /** 0-100. How far the set spans the blue-yellow axis. */
  warmCool: number;
  /** 0-100. How far the set spans light to dark. */
  lightness: number;
  warmest: string;
  coolest: string;
  lightest: string;
  darkest: string;
};

const scale = (value: number, ceiling: number) => Math.round(Math.min(1, value / ceiling) * 100);

export function measureSeparation(hexes: string[]): Separation | null {
  if (hexes.length < 2) return null;
  const px = hexes.map((hex) => ({ hex, ...rgbToOklab(hexToRgb(hex)) }));
  const b = px.map((p) => p.b);
  const mean = b.reduce((a, x) => a + x, 0) / b.length;
  const bStd = Math.sqrt(b.reduce((a, x) => a + (x - mean) ** 2, 0) / b.length);
  const pick = (key: 'b' | 'L', best: (a: number, x: number) => boolean) =>
    px.reduce((a, x) => (best(x[key], a[key]) ? x : a)).hex;

  return {
    warmCool: scale(bStd, B_CEILING),
    lightness: scale(Math.max(...px.map((p) => p.L)) - Math.min(...px.map((p) => p.L)), L_CEILING),
    warmest: pick('b', (a, x) => a > x),
    coolest: pick('b', (a, x) => a < x),
    lightest: pick('L', (a, x) => a > x),
    darkest: pick('L', (a, x) => a < x),
  };
}
