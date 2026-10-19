/**
 * Color math — DOM-free so it can be unit-tested in plain node (`npm test`).
 *
 * Conventions
 *  - hue   : degrees 0..360 (HSL/HSV hue, same wheel the original tool uses)
 *  - s, l  : 0..100 (integers when displayed)
 *  - oklch : perceptual. Used internally for chroma / distance / neutral floor.
 */

export type RGB = { r: number; g: number; b: number }; // 0..255
export type HSL = { h: number; s: number; l: number }; // h 0..360, s/l 0..100
export type OKLCH = { l: number; c: number; h: number }; // l 0..1, c 0..~0.4, h deg

/* ------------------------------------------------------------------ hex/rgb */

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function hexToRgb(hex: string): RGB {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  if (!Number.isFinite(n)) return { r: 0, g: 0, b: 0 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

const to2 = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');

export function rgbToHex({ r, g, b }: RGB): string {
  return `#${to2(r)}${to2(g)}${to2(b)}`.toUpperCase();
}

/* ------------------------------------------------------------------ hsl */

/**
 * Input contract: r/g/b are 0..255. Nothing clamps here on purpose — every caller gets its
 * numbers from `hexToRgb` (bit-shifted out of a hex string, so always in range) or from
 * `ImageData` (a Uint8Array, so in range by construction). Clamping would only hide a caller
 * that stopped honouring that. `hexToRgb` is the one place that has to face garbage, and it
 * answers garbage with black.
 */
export function rgbToHsl({ r, g, b }: RGB): HSL {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === R) h = 60 * (((G - B) / d) % 6);
    else if (max === G) h = 60 * ((B - R) / d + 2);
    else h = 60 * ((R - G) / d + 4);
  }
  h = (h + 360) % 360;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h, s: s * 100, l: l * 100 };
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  const H = ((h % 360) + 360) % 360, S = clamp(s, 0, 100) / 100, L = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * L - 1)) * S;
  const x = c * (1 - Math.abs(((H / 60) % 2) - 1));
  const m = L - c / 2;
  let r = 0, g = 0, b = 0;
  if (H < 60) [r, g, b] = [c, x, 0];
  else if (H < 120) [r, g, b] = [x, c, 0];
  else if (H < 180) [r, g, b] = [0, c, x];
  else if (H < 240) [r, g, b] = [0, x, c];
  else if (H < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  // Rounded, because RGB means 0..255: unrounded this returns 254.99999999999997 for pure
  // white, and 89% of the h/s/l space came out non-integer. Only `rgbToHex` consumed it so
  // far (it rounds anyway), but a lying type is how an off-by-one hex gets written.
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
}

export const hexToHsl = (hex: string): HSL => rgbToHsl(hexToRgb(hex));
export const hslToHex = (h: HSL): string => rgbToHex(hslToRgb(h));

/** Build the display wheel color: white at the centre -> full hue at the rim. */
/**
 * The colour model the hue wheel is drawn from: saturation grows outward, lightness falls
 * half as fast, so the rim is a full hue and the centre is white.
 *
 * This is the reference tool's wheel, and it is the only place that model is written down.
 * The disc raster and every colour the app shows come out of the same two lines, which is
 * what makes a dot on the wheel a statement about the colour it is sitting on.
 */
export function wheelRgb(hue: number, radius: number): RGB {
  const r = clamp(radius, 0, 1);
  return hslToRgb({ h: hue, s: r * 100, l: 100 - r * 50 });
}

/** The same, as a hex string. */
export function wheelColor(hue: number, radius: number): string {
  return rgbToHex(wheelRgb(hue, radius));
}

/* ------------------------------------------------------------------ oklab */

const lin = (v: number) => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

export function rgbToOklab({ r, g, b }: RGB) {
  const R = lin(r), G = lin(g), B = lin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

export function rgbToOklch(rgb: RGB): OKLCH {
  const { L, a, b } = rgbToOklab(rgb);
  return { l: L, c: Math.hypot(a, b), h: (Math.atan2(b, a) * 180 / Math.PI + 360) % 360 };
}
export const hexToOklch = (hex: string): OKLCH => rgbToOklch(hexToRgb(hex));

/** Perceptual distance (ΔE_ok, ~2.3 is a common JND). */
export function deltaE(hexA: string, hexB: string): number {
  const A = rgbToOklab(hexToRgb(hexA)), B = rgbToOklab(hexToRgb(hexB));
  return Math.hypot(A.L - B.L, A.a - B.a, A.b - B.b) * 100;
}

/**
 * Max chroma reachable inside sRGB for a hue (at a mid lightness).
 * Used to answer "is this colour actually colourful, or just grey?".
 */
const CMAX_STEPS = 360;
let cmaxCache: Float32Array | null = null;
const EPS = 1e-4;

/** True when the OKLab colour encodes inside the sRGB cube (checked in linear light). */
function inGamut(L: number, C: number, h: number): boolean {
  const rad = h * Math.PI / 180;
  const a = C * Math.cos(rad), b = C * Math.sin(rad);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const R = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const G = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const B = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return [R, G, B].every((v) => v >= -EPS && v <= 1 + EPS);
}
export function maxChroma(hue: number): number {
  if (!cmaxCache) {
    cmaxCache = new Float32Array(CMAX_STEPS);
    for (let i = 0; i < CMAX_STEPS; i++) {
      const h = (i * 360) / CMAX_STEPS;
      let lo = 0, hi = 0.45;
      for (let k = 0; k < 22; k++) {
        const mid = (lo + hi) / 2;
        if (inGamut(0.72, mid, h)) lo = mid; else hi = mid;
      }
      cmaxCache[i] = lo;
    }
  }
  return cmaxCache[Math.round((((hue % 360) + 360) % 360) / (360 / CMAX_STEPS)) % CMAX_STEPS];
}

/**
 * Maximum chroma reachable at a *specific* lightness — the plain `maxChroma()` is sampled
 * at L 0.72, which wildly overestimates what a shadow or a highlight can hold.
 */
const cmaxAtCache = new Map<string, number>();
export function maxChromaAt(lightness: number, hue: number): number {
  const key = `${Math.round(lightness * 200)}_${Math.round((((hue % 360) + 360) % 360))}`;
  const hit = cmaxAtCache.get(key);
  if (hit !== undefined) return hit;
  let lo = 0, hi = 0.45;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(lightness, mid, hue)) lo = mid; else hi = mid;
  }
  cmaxAtCache.set(key, lo);
  return lo;
}

/**
 * How loud a colour is *for the hue and lightness it has*: 0 = grey, 1 = as vivid as that
 * corner of the gamut allows. HSL saturation is not this — two colours at S 60 can be miles
 * apart in loudness depending on their hue.
 */
export function loudness(hex: string): number {
  const { l, c, h } = hexToOklch(hex);
  return clamp(c / Math.max(0.01, maxChromaAt(l, h)), 0, 1);
}

/** Chroma relative to what is achievable at that hue: 0 = grey, 1 = maximally vivid. */
export function chromaRatio(hex: string): number {
  const { c, h } = hexToOklch(hex);
  return clamp(c / Math.max(0.02, maxChroma(h)), 0, 1);
}

/**
 * Suggested colour after moving hue only, keeping S and L — this is what the
 * reference tool prints (verified: #AFBBC5 @ hue 90 -> #BAC5AF exactly).
 */
export function retarget(hexc: string, targetHue: number): string {
  const { s, l } = hexToHsl(hexc);
  return hslToHex({ h: targetHue, s, l });
}

/**
 * Move hue while keeping what the eye actually tracks: OKLab lightness, and chroma as a
 * fraction of what that hue can hold at that lightness.
 *
 * Constant-S HSL rotation is the wrong move more often than it looks right: S 80 orange is
 * loud and S 80 cyan is not, because the two hues hold different amounts of chroma. The
 * gap between them is exactly the saturation number this returns — which is why the
 * hue-only mode can only ever print `sat 0`.
 */
export function retargetRelative(hexc: string, targetHue: number): string {
  const { l } = hexToHsl(hexc);
  const want = loudness(hexc);
  const at = (sat: number) => hslToHex({ h: targetHue, s: sat, l });
  // HSL hue is a direct parameter, so fixing it keeps the colour exactly on the hue the
  // wheel and the slot table name — no searching between two hue scales, which does not
  // converge for muted colours whose HSL hue is mostly rounding. Loudness then rises
  // monotonically with HSL saturation at a fixed hue and lightness, so bisection is enough.
  let lo = 0, hi = 100;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (loudness(at(mid)) < want) lo = mid; else hi = mid;
  }
  return at((lo + hi) / 2);
}

/* ------------------------------------------------------------------ hue names */

/**
 * Hue naming table. The `name` is a *locale key* (`hue.sky-blue` in the dictionary),
 * not display text — render it with `hueLabel()` / `t('hue.' + hueName(h))`.
 *
 * Boundaries are uneven on purpose: they are calibrated to the seven labelled samples
 * visible in the reference screenshots
 * (20/28 red-orange · 31 orange · 60 yellow · 84/94 yellow-green · 207 sky blue · 280 violet).
 * The original table is not fully recoverable from screenshots, so the un-observed
 * buckets are sensible interpolations — tune here, everything else reads from this.
 */
export const HUE_NAMES: { name: string; from: number; to: number }[] = [
  { name: 'red', from: 350, to: 10 },
  { name: 'red-orange', from: 10, to: 30 },
  { name: 'orange', from: 30, to: 55 },
  { name: 'yellow', from: 55, to: 78 },
  { name: 'yellow-green', from: 78, to: 105 },
  { name: 'green', from: 105, to: 150 },
  { name: 'teal-green', from: 150, to: 172 },
  { name: 'cyan', from: 172, to: 193 },
  { name: 'turquoise', from: 193, to: 202 },
  { name: 'sky-blue', from: 202, to: 218 },
  { name: 'azure', from: 218, to: 232 },
  { name: 'blue', from: 232, to: 262 },
  { name: 'indigo', from: 262, to: 272 },
  { name: 'violet', from: 272, to: 295 },
  { name: 'purple', from: 295, to: 315 },
  { name: 'magenta', from: 315, to: 335 },
  { name: 'pink', from: 335, to: 350 },
];

export function hueName(hue: number): string {
  const h = ((hue % 360) + 360) % 360;
  for (const b of HUE_NAMES) {
    const inside = b.from < b.to ? h >= b.from && h < b.to : h >= b.from || h < b.to;
    if (inside) return b.name;
  }
  return 'red';
}

/* ------------------------------------------------------------------ angles */

/** White or near-black text for a chip painted with `hex`. */
export function readableOn(hex: string): '#ffffff' | '#1b1714' {
  const { r, g, b } = hexToRgb(hex);
  const lin = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const Y = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return Y > 0.42 ? '#1b1714' : '#ffffff';
}

/** Shortest signed distance from `a` to `b` on the hue circle (-180..180). */
export function hueDelta(a: number, b: number): number {
  let d = ((b - a + 540) % 360) - 180;
  if (d === -180) d = 180;
  return d;
}
export const hueDist = (a: number, b: number): number => Math.abs(hueDelta(a, b));

/**
 * What an editor's HSL sliders actually ask for: a signed hue rotation (shortest way
 * round, so 350° → 10° reads as +12 and not -340) plus saturation and lightness deltas
 * in percentage points. Everything rounded to what a slider can be set to.
 */
export function hslDelta(fromHex: string, toHex: string): { h: number; s: number; l: number } {
  const a = hexToHsl(fromHex), b = hexToHsl(toHex);
  return { h: Math.round(hueDelta(a.h, b.h)), s: Math.round(b.s - a.s), l: Math.round(b.l - a.l) };
}
export const addHue = (h: number, d: number): number => (h + d + 720) % 360;

