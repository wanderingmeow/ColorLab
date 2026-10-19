/**
 * Synthetic frames for the pixel layer.
 *
 * `Sampler.loadPixels` takes a decoded RGBA buffer, so the whole reading path can be
 * exercised without a canvas, a browser, or a photograph committed to the repo. Paint
 * functions keep each test's picture describable in one line.
 */

export type Paint = (x: number, y: number) => [number, number, number];

export function frame(w: number, h: number, paint: Paint): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = paint(x, y);
      const i = (y * w + x) * 4;
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
    }
  }
  return d;
}

/** one flat colour everywhere */
export const flat = (rgb: [number, number, number], w = 21, h = 21) => frame(w, h, () => rgb);

/** a single hot pixel in the middle of a flat field */
export const withSpeck = (rgb: [number, number, number], speck: [number, number, number]): Uint8ClampedArray => {
  const w = 21, h = 21;
  const d = frame(w, h, () => rgb);
  const i = ((h >> 1) * w + (w >> 1)) * 4;
  d[i] = speck[0]; d[i + 1] = speck[1]; d[i + 2] = speck[2];
  return d;
};

/** hard vertical edge at the middle — the thing a sample area must not straddle */
export const edge = (a: [number, number, number], b: [number, number, number], w = 21, h = 21): Uint8ClampedArray =>
  frame(w, h, (x) => (x < w / 2 ? a : b));

/** four quadrants, four colours: a frame that genuinely holds four hues */
export const quadrants = (
  inks: [[number, number, number], [number, number, number], [number, number, number], [number, number, number]],
  w = 60, h = 60,
): Uint8ClampedArray => frame(w, h, (x, y) => inks[(y < h / 2 ? 0 : 2) + (x < w / 2 ? 0 : 1)]);
