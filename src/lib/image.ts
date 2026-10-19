/**
 * Everything that touches pixels. The full-resolution image is never kept: we
 * decode into a downscaled canvas (max edge 1600px) used for sampling, loupe,
 * prominence and suggestions. There is no network call anywhere in this module: pixels are
 * read here and nowhere else.
 */
import { deltaE, hexToOklch, hexToRgb, rgbToHex, rgbToHsl, rgbToOklab } from './color.ts';

const MAX_EDGE = 1600;

/**
 * Inclusive index span of an n×n patch centred on the pixel under the cursor.
 * Even sizes cannot be centred on a pixel, so they run one further right and down —
 * the same convention Photoshop's sample size uses.
 */
export function patchRange(n: number): { from: number; to: number } {
  const from = -Math.floor((n - 1) / 2);
  return { from, to: from + n - 1 };
}

/** One pixel's place in the hue map, and the colour it actually is. */
export type HuePoint = { hue: number; r: number; hex: string };

export type LabPoint = { u: number; v: number; L: number; a: number; b: number };

/**
 * The number below which a colour counts as already represented. OKLab distances here are
 * on the L∈0–1, |a|,|b|≲0.4 scale, so 0.045 is a difference you can see if you look for it
 * and ignore if you do not — worth a dot at four, not worth one at eight.
 */
export const COVERED = 0.045;

/**
 * Greedy farthest-first over candidates, with an early stop: the set grows while the frame
 * still holds a colour nobody represents, and stops the moment it does not — between `min`
 * and `max` points. A wall gets four. A market stall gets eight. Counting to a fixed number
 * is the wrong question; "is anything left unrepresented" is the right one.
 *
 * A candidate is only eligible while it carries a colour nobody has yet. That eligibility
 * rule matters more than the metric: without it, `colour + 0.85 × space` happily trades a
 * real new colour for the *same* colour in a different corner — the mirror-pose photo where
 * one yellow cuff is on the left paw and the identical one on the right. Space is a
 * tiebreaker between new colours, not a substitute for one.
 *
 * Below the floor the rule relaxes on purpose: a frame that only holds two colours still
 * gets its four points, chosen for spread, because the floor was asked for.
 */
export function spreadPicks<T extends LabPoint>(cands: T[], min = 4, max = 8, covered = COVERED): T[] {
  if (!cands.length) return [];
  // start from the most chromatic point: the strongest colour is the one worth measuring
  // everything else against, and a grey starting point makes every gap look small
  let first = cands[0];
  let bestC = -1;
  for (const c of cands) {
    const chroma = Math.hypot(c.a, c.b);
    if (chroma > bestC) { bestC = chroma; first = c; }
  }
  const picked: T[] = [first];
  while (picked.length < max && picked.length < cands.length) {
    let fresh: T | null = null, freshScore = -Infinity;
    let spread: T | null = null, spreadScore = -Infinity;
    for (const c of cands) {
      if (picked.includes(c)) continue;
      let near = Infinity, gap = Infinity;
      for (const p of picked) {
        const col = Math.hypot(c.L - p.L, c.a - p.a, c.b - p.b);
        const spa = Math.hypot(c.u - p.u, c.v - p.v);
        if (col < gap) gap = col;
        const d = col + spa * 0.85;
        if (d < near) near = d;
      }
      if (gap >= covered) {
        if (near > freshScore) { freshScore = near; fresh = c; }
      } else if (near > spreadScore) {
        spreadScore = near; spread = c;
      }
    }
    // a new colour first, always; only the floor may settle for a well-placed duplicate
    const next = fresh ?? (picked.length < min ? spread : null);
    if (!next) break;
    picked.push(next);
  }
  return picked;
}

/**
 * Keep a normalised point far enough from the ends of an n-pixel axis that a patch of
 * `size` centred on it stays inside the image.
 *
 * A dot dropped on the frame's edge reports a colour averaged from pixels that do not
 * exist — half a 32×32 reading outside the picture is a colour invented on the spot. So the
 * point is not allowed there, rather than warned about afterwards.
 */
export function clampAxis(x: number, n: number, size: number): number {
  if (n <= 1) return 0;
  const { from, to } = patchRange(size);
  const lo = -from;
  const hi = n - 1 - to;
  if (lo > hi) return 0.5;   // the patch is wider than the image: nowhere fits, centre it
  const c = Math.min(1, Math.max(0, x)) * (n - 1);
  return Math.min(Math.max(c, lo), hi) / (n - 1);
}

/** Middle of a set of values — the summary a patch reading needs. */
export function median(values: number[]): number {
  if (!values.length) return 0;
  const v = [...values].sort((a, b) => a - b);
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export type Loaded = { src: string; name: string; w: number; h: number };

const OK_TYPES = /^image\/(png|jpe?g|webp|gif|bmp|avif|heic|heif)$/i;

export function readImageFile(file: File): Promise<Loaded> {
  return new Promise((resolve, reject) => {
    if (!OK_TYPES.test(file.type) && !/\.(png|jpe?g|jpeg|webp|gif|bmp|avif|heic|heif)$/i.test(file.name)) {
      reject(new Error('Please drop a JPG or PNG file.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      const src = String(reader.result);
      const img = new Image();
      img.onload = () => resolve({ src, name: file.name, w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => reject(new Error('That image could not be decoded — try exporting it as JPG.'));
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

export class Sampler {
  private canvas?: HTMLCanvasElement;
  private data?: Uint8ClampedArray;
  private sw = 0;
  private sh = 0;

  async load(src: string): Promise<void> {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('decode failed'));
      i.src = src;
    });
    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    this.sw = Math.max(1, Math.round(img.naturalWidth * scale));
    this.sh = Math.max(1, Math.round(img.naturalHeight * scale));
    const c = document.createElement('canvas');
    c.width = this.sw; c.height = this.sh;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('canvas unavailable');
    ctx.drawImage(img, 0, 0, this.sw, this.sh);
    this.loadPixels(ctx.getImageData(0, 0, this.sw, this.sh).data, this.sw, this.sh, c);
  }

  /**
   * Take an already-decoded frame.
   *
   * `load()` is the browser path (decode, downscale, read back); this is the seam under it.
   * Every reading method — sampleAt, spreadAt, prominence, suggest, looksEdited — works from
   * `data` alone, so a synthetic frame can exercise them without a canvas, a browser, or a
   * photograph checked into the repo. `drawZoom` is the one method that still needs the
   * picture itself, and it says so by doing nothing here rather than inventing pixels.
   *
   * `source` is the picture these pixels came from, and it travels in the SAME call on
   * purpose: the loupe magnifies the canvas, not the array. When it was a separate statement
   * the two lines got into the wrong order — `load()` set the canvas and `loadPixels()` then
   * cleared it — and every loupe in the app drew nothing at all: an empty ring with the page
   * showing through. Two things that have to agree are one argument.
   */
  loadPixels(rgba: Uint8ClampedArray, w: number, h: number, source?: HTMLCanvasElement): void {
    this.data = rgba;
    this.sw = w;
    this.sh = h;
    this.canvas = source;
  }

  get ready() { return !!this.data; }

  /**
   * 5×5 area sample — a single pixel on sky, fog or sensor noise is not a colour.
   *
   * The mean of those 25 was the wrong summary: one specular speck, a hairline or a hot
   * pixel inside the patch pulled the whole reading, and the dot then disagreed with the
   * colour the eye picked out. The per-channel median cannot be moved by one outlier, and
   * on a flat patch — the case that matters — it returns the same colour as the mean.
   *
   * The kernel is 5×5 on the working canvas, which is itself capped at 1600px, so on a
   * 6000px-wide photo it covers roughly 19×19 source pixels. That is deliberate: the dot
   * should answer "what colour is this area", not "what is this pixel".
   */
  sampleAt(u: number, v: number, size = 5): string | null {
    const d = this.data;
    if (!d) return null;
    const cx = Math.round(u * (this.sw - 1));
    const cy = Math.round(v * (this.sh - 1));
    const { from, to } = patchRange(size);
    const r: number[] = [], g: number[] = [], b: number[] = [];
    for (let dy = from; dy <= to; dy++) {
      for (let dx = from; dx <= to; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= this.sw || y >= this.sh) continue;
        const i = (y * this.sw + x) * 4;
        r.push(d[i]); g.push(d[i + 1]); b.push(d[i + 2]);
      }
    }
    if (!r.length) return null;
    return rgbToHex({ r: median(r), g: median(g), b: median(b) });
  }

  /**
   * How far the patch strays from the colour it reports, in ΔE. A flat wall sits near 0;
   * a dot dropped on a seam between two colours reads 10+, and that average is a colour
   * that is in the photo nowhere.
   */
  spreadAt(u: number, v: number, size = 5, hex = this.sampleAt(u, v, size)): number {
    const d = this.data;
    if (!d || !hex) return 0;
    const cx = Math.round(u * (this.sw - 1));
    const cy = Math.round(v * (this.sh - 1));
    const { from, to } = patchRange(size);
    let worst = 0;
    for (let dy = from; dy <= to; dy++) {
      for (let dx = from; dx <= to; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= this.sw || y >= this.sh) continue;
        const i = (y * this.sw + x) * 4;
        const e = deltaE(hex, rgbToHex({ r: d[i], g: d[i + 1], b: d[i + 2] }));
        if (e > worst) worst = e;
      }
    }
    return worst;
  }

  /** A patch this far from its own reading is an edge, not a colour. */
  static readonly EDGE_SPREAD = 6;

  /** Pull a point back until its whole sample area sits on the photo. */
  clampToSample(u: number, v: number, size = 5): { u: number; v: number } {
    if (!this.sw || !this.sh) return { u: Math.min(1, Math.max(0, u)), v: Math.min(1, Math.max(0, v)) };
    return { u: clampAxis(u, this.sw, size), v: clampAxis(v, this.sh, size) };
  }

  /**
   * Paint a magnified patch (the loupe) centred on u,v, with the sampled area marked.
   * The magnification follows the sample size: a 3×3 point is shown big, a 32×32 area is
   * shown nearly as-is, because at that size the whole point is seeing how big the area is.
   */
  drawZoom(ctx: CanvasRenderingContext2D, size: number, u: number, v: number, sample = 5) {
    // no picture, nothing to magnify (a frame fed through loadPixels has no canvas)
    if (!this.canvas) return;
    const view = Math.max(sample * 2, 9);
    const zoom = Math.min(12, Math.max(1.2, size / view));
    const patch = size / zoom;          // canvas pixels shown across the loupe
    const scale = size / patch;

    // The cursor stays in the middle of the loupe — that is the whole point of a loupe.
    // Near an edge, the window therefore reaches past the photo, and drawImage() would
    // leave that part transparent: the page showed through and the readout looked broken.
    // So the area outside the image is painted as "no pixels here", which also tells the
    // truth about a large sample area dropped on the frame's edge — half of it is not data.
    const x0 = u * this.sw - patch / 2;
    const y0 = v * this.sh - patch / 2;
    const ix = (0 - x0) * scale, iy = (0 - y0) * scale;      // where the photo lands
    const iw = this.sw * scale, ih = this.sh * scale;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#cbbfb0';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(20,17,15,.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let d = -size; d < size * 2; d += 7) { ctx.moveTo(d, 0); ctx.lineTo(d + size, size); }
    ctx.stroke();

    // the photo itself, clipped to the loupe by intersecting the two rectangles
    const vx = Math.max(0, ix), vy = Math.max(0, iy);
    const vw = Math.min(size, ix + iw) - vx, vh = Math.min(size, iy + ih) - vy;
    if (vw > 0 && vh > 0) {
      ctx.drawImage(this.canvas, (vx - ix) / scale, (vy - iy) / scale, vw / scale, vh / scale, vx, vy, vw, vh);
      // the frame's edge, so empty space is never mistaken for a colour
      ctx.strokeStyle = 'rgba(20,17,15,.6)';
      ctx.beginPath();
      if (ix > 0) { const x = Math.round(ix) + .5; ctx.moveTo(x, 0); ctx.lineTo(x, size); }
      if (iy > 0) { const y = Math.round(iy) + .5; ctx.moveTo(0, y); ctx.lineTo(size, y); }
      if (ix + iw < size) { const x = Math.round(ix + iw) + .5; ctx.moveTo(x, 0); ctx.lineTo(x, size); }
      if (iy + ih < size) { const y = Math.round(iy + ih) + .5; ctx.moveTo(0, y); ctx.lineTo(size, y); }
      ctx.stroke();
    }

    // the sampled area, dead centre because the cursor is dead centre
    const k = sample * scale;
    const mx = (size - k) / 2, my = (size - k) / 2;
    ctx.strokeStyle = 'rgba(250,246,238,.9)';
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(mx) + .5, Math.round(my) + .5, Math.round(k), Math.round(k));
    ctx.strokeStyle = 'rgba(20,17,15,.55)';
    ctx.strokeRect(Math.round(mx) - .5, Math.round(my) - .5, Math.round(k) + 2, Math.round(k) + 2);
  }

  /**
   * Share of the frame each sample stands for (nearest-colour vote on a coarse
   * grid) — the sky should outvote one small flower when scoring a harmony.
   */
  /**
   * The photograph plotted in hue space: angle is hue, radius is how loud the pixel is.
   *
   * Both axes are the wheel's own: **HSL hue** for the angle (the one the rim labels name
   * and the sample dots are placed by) and **HSL saturation** for the radius, exactly as
   * `radiusFor` places a dot on the Natural disc. So a pixel of the photograph sits where
   * that colour sits on the wheel — one coordinate system, two circles, and colours that
   * look the same land in the same place in both.
   *
   * `loudness()` was tried first and it tells a truer fact: most of a photograph is not
   * vivid, so dividing every pixel by its hue's gamut ceiling crushed the whole cloud into
   * the middle and the shape of the picture was lost. A coordinate system is not a
   * measurement; it is a place to put things, and this one has to match the wheel.
   *
   * OKLab keeps the job it is good at: deciding which pixels are too grey to plot.
   *
   * Neutrals are dropped below `floor`. A pixel with no chroma has a hue, but not one anybody
   * could name, and a cloud of them is a smear through the centre that hides the shape of the
   * photograph. The stride is an even grid so the cloud keeps its shape rather than its
   * diagonal; the cap exists because ten thousand dots say no more than three thousand do.
   */
  huePoints(opts: { max?: number; floor?: number } = {}): HuePoint[] {
    const max = opts.max ?? 6000;
    const floor = opts.floor ?? 0.02;
    const d = this.data;
    if (!d) return [];
    const stride = Math.max(1, Math.ceil(Math.sqrt((this.sw * this.sh) / max)));
    const out: HuePoint[] = [];
    for (let y = 0; y < this.sh; y += stride) {
      for (let x = 0; x < this.sw; x += stride) {
        const i = (y * this.sw + x) * 4;
        const rgb = { r: d[i], g: d[i + 1], b: d[i + 2] };
        const { a, b } = rgbToOklab(rgb);
        if (Math.hypot(a, b) < floor) continue;
        const { h, s } = rgbToHsl(rgb);
        out.push({ hue: h, r: s / 100, hex: rgbToHex(rgb) });
      }
    }
    return out;
  }

  prominence(entries: { id: string; hex: string }[]): Record<string, number> {
    const out: Record<string, number> = {};
    entries.forEach((e) => (out[e.id] = 0));
    const d = this.data;
    if (!d || !entries.length) return out;
    const refs = entries.map((e) => hexToOklch(e.hex));
    const G = 48;
    const counts = new Array(entries.length).fill(0);
    let votes = 0;
    for (let gy = 0; gy < G; gy++) {
      for (let gx = 0; gx < G; gx++) {
        const x = Math.floor(((gx + 0.5) / G) * this.sw);
        const y = Math.floor(((gy + 0.5) / G) * this.sh);
        const i = (y * this.sw + x) * 4;
        const p = hexToOklch(rgbToHex({ r: d[i], g: d[i + 1], b: d[i + 2] }));
        let best = 0, bestD = Infinity;
        refs.forEach((r, k) => {
          const dd = (p.l - r.l) ** 2 + (p.c - r.c) ** 2 + (((p.h - r.h) * Math.PI / 180) ** 2) * 0.25;
          if (dd < bestD) { bestD = dd; best = k; }
        });
        counts[best]++; votes++;
      }
    }
    entries.forEach((e, k) => (out[e.id] = votes ? counts[k] / votes : 0));
    return out;
  }

  /**
   * Farthest-first proposal over a coarse grid with a spatial spread penalty, so
   * beginners get a representative set instead of eight dots on the sky.
   */
  suggest(size = 5, min = 4, max = 8): { u: number; v: number; hex: string }[] {
    if (!this.data) return [];
    const G = 36;
    type Cand = LabPoint & { hex: string };
    const cands: Cand[] = [];
    for (let gy = 0; gy < G; gy++) {
      for (let gx = 0; gx < G; gx++) {
        const u = (gx + 0.5) / G, v = (gy + 0.5) / G;
        // a point whose sample area would hang off the frame is not offerable: the dot would
        // be pulled back on placement and read a different colour than the one proposed
        const at = this.clampToSample(u, v, size);
        if (Math.abs(at.u - u) > 1e-9 || Math.abs(at.v - v) > 1e-9) continue;
        const hex = this.sampleAt(u, v, size);
        if (!hex) continue;
        const o = rgbToOklab(hexToRgb(hex));
        cands.push({ u, v, hex, L: o.L, a: o.a, b: o.b });
      }
    }
    return spreadPicks(cands, min, max).map((p) => ({ u: p.u, v: p.v, hex: p.hex }));
  }

  /** "This image already carries a grade" warning — the analysis reads the render, not the scene. */
  looksEdited(): { cast: 'warm' | 'cool'; clipped: number } | null {
    const d = this.data;
    if (!d) return null;
    let r = 0, b = 0, n = 0, clipped = 0;
    for (let i = 0; i < d.length; i += 4 * 29) {
      r += d[i]; b += d[i + 2]; n++;
      const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
      if (lum < 20 || lum > 240) clipped++;
    }
    const cast = (r - b) / n;
    const clipRatio = clipped / n;
    if (Math.abs(cast) > 16) return { cast: cast > 0 ? 'warm' : 'cool', clipped: clipRatio };
    if (clipRatio > 0.14) return { cast: 'warm', clipped: clipRatio };
    return null;
  }
}

export const sampler = new Sampler();
