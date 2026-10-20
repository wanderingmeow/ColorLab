import { chromaRatio, hexToOklch, hexToRgb, rgbToOklab } from './color.ts';

/**
 * Three reading aids that are not measurements.
 *
 * Each one answers a question the harmony maths cannot ask, because the maths only sees
 * numbers per sample: what a *viewer* brings to this colour (memory colour), which control in
 * an editor a suggestion belongs to (scope), and whether this colour is a thing at all or just
 * distance (aerial perspective). None of them is a threshold science gave us. Where the research
 * supports a direction but not a number, the number here is ours and the comment says so — and
 * the UI text is written to match, so "may be" is never upgraded to "is".
 */

/* ------------------------------------------------------------------ memory colour */

/**
 * Viewers hold a memory colour for familiar things, and that memory colour drags preference
 * with it: memory colours of familiar objects — fruit above all — induce general colour
 * preference (Liao et al. 2023, Color Res. Appl., 10.1002/col.22906), with earlier evidence in
 * Pérez-Carpinell et al. 1998, and Palmer & Schloss 2010 explaining preference through the
 * objects a colour is associated with.
 *
 * What that literature does NOT give us is a tolerance: nobody published "sky may move 14°
 * before it stops looking like sky". So these are deliberately wide bands, named after the
 * subject rather than the hue, and the message says "common colour sense", not "wrong".
 */
export type MemoryFamily = 'sky' | 'foliage' | 'skin';

const MEMORY: { key: MemoryFamily; from: number; to: number }[] = [
  { key: 'sky', from: 190, to: 255 },
  { key: 'foliage', from: 75, to: 165 },
  { key: 'skin', from: 5, to: 45 },
];

const inBand = (h: number, b: { from: number; to: number }) =>
  b.from <= b.to ? h >= b.from && h < b.to : h >= b.from || h < b.to;

/** Which of the three subjects this HSL hue is commonly coloured like, if any. */
export function memoryFamily(hue: number): MemoryFamily | null {
  const h = ((hue % 360) + 360) % 360;
  return MEMORY.find((b) => inBand(h, b))?.key ?? null;
}

/**
 * The memory colour this dot is being asked to leave: the family its measured hue sits in, but
 * only if the target hue steps outside that band. A move that stays inside the band is not a
 * move away from the memory colour, so it gets no warning.
 */
export function memoryLeft(fromHue: number, toHue: number): MemoryFamily | null {
  const family = memoryFamily(fromHue);
  if (!family) return null;
  const band = MEMORY.find((b) => b.key === family)!;
  return inBand(((toHue % 360) + 360) % 360, band) ? null : family;
}

/* ------------------------------------------------------------------ scope */

/**
 * The eight hue sliders every serious editor exposes — Lightroom and Camera Raw's HSL panel,
 * Photoshop's Hue/Saturation adjustment, and the hue curves in DaVinci Resolve all work band by
 * band. A suggestion that says "turn this colour 12°" is not actionable until it says which
 * band to drag, so we name the band the same way those tools do.
 *
 * The boundaries are ours, placed to match how those eight sliders are labelled and ordered;
 * they are a UI affordance, not a colour-science boundary.
 */
export type HueBand =
  | 'reds' | 'oranges' | 'yellows' | 'greens' | 'aquas' | 'blues' | 'purples' | 'magentas';

export const HUE_BANDS: { key: HueBand; from: number; to: number }[] = [
  { key: 'reds', from: 345, to: 15 },
  { key: 'oranges', from: 15, to: 45 },
  { key: 'yellows', from: 45, to: 75 },
  { key: 'greens', from: 75, to: 165 },
  { key: 'aquas', from: 165, to: 205 },
  { key: 'blues', from: 205, to: 255 },
  { key: 'purples', from: 255, to: 290 },
  { key: 'magentas', from: 290, to: 345 },
];

export function hueBand(hue: number): HueBand {
  const h = ((hue % 360) + 360) % 360;
  return (HUE_BANDS.find((b) => inBand(h, b)) ?? HUE_BANDS[0]).key;
}

/**
 * Which lightness band a colour lives in, named the way grading tools name them. Oklab L is
 * used because it is the lightness we already measure; the cut points are ours — Oklab L is
 * about 0.35 for a 20% grey and 0.80 for a light grey, so the bands break where a photographer
 * would say "shadows" and "highlights".
 */
export type LightBand = 'shadows' | 'midtones' | 'highlights';

export function lightBand(hex: string): LightBand {
  const { l } = hexToOklch(hex);
  return l < 0.45 ? 'shadows' : l > 0.78 ? 'highlights' : 'midtones';
}

/* ------------------------------------------------------------------ aerial perspective */

/**
 * Distance seen through air: the further a thing is, the lower its contrast and chroma, the
 * closer its colour to the sky behind it, and the brighter it reads (Wikipedia, "Aerial
 * perspective", which also notes the shift is *usually* toward blue). Painters and landscape
 * photographers use this as depth, not as a colour in the scene.
 *
 * That makes a low-chroma, bright, cool sample covering a large share of the frame a special
 * case for this tool: it is often not an object, so making it one arm of a skeleton flattens
 * the distance, and its large area share can give it enough weight to anchor the whole scheme.
 *
 * The four conditions below are ours, not a published detector, and indoor frames, studio
 * frames and dry high-altitude air all produce colours that satisfy them without being
 * distance. The UI therefore says "this may be aerial perspective" and offers a choice, never a
 * correction.
 */
export function aerialHazard(hex: string, areaShare: number): boolean {
  const { l } = hexToOklch(hex);
  const { b } = rgbToOklab(hexToRgb(hex)); // Oklab's b: the blue-yellow axis, which OKLCH has folded into h
  const chroma = chromaRatio(hex);
  return chroma >= 0.06 && chroma <= 0.4 && l >= 0.68 && b < 0 && areaShare >= 0.12;
}
