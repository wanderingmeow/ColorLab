/**
 * The pixel layer, against frames nobody photographed.
 *
 * These are the readings the whole app is built on: what a sample point says a colour is,
 * how much of the frame a point stands for, and where a suggested point may be placed.
 * Until now none of it had a test — `Sampler.load()` needed a browser, so nothing was
 * tested, and two user-reported bugs (a loupe clipped at the frame edge, points draggable
 * off the photo) could only be chased by eye. `loadPixels` is the seam that closes that.
 */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { Sampler } from '../src/lib/image.ts';
import { hueDist, rgbToHex, rgbToHsl } from '../src/lib/color.ts';
import { edge, flat, frame, quadrants, withSpeck } from './frame.ts';

type RGB3 = [number, number, number];
const INK: Record<string, RGB3> = {
  blue: [32, 56, 160],
  yellow: [224, 192, 64],
  red: [190, 40, 40],
  green: [40, 150, 70],
  grey: [128, 128, 128],
};
const hexOf = (c: RGB3) => rgbToHex({ r: c[0], g: c[1], b: c[2] });

/**
 * A 2d context that only remembers what it was asked to draw.
 *
 * Whether the browser paints a loupe is not in question; whether `drawZoom` reached the
 * canvas at all is — that is the difference between a magnifier and an empty ring.
 */
const loupeCtx = (drawn: unknown[][]) =>
  new Proxy({} as Record<string, unknown>, {
    get: (o, k) => (k === 'drawImage'
      ? (...a: unknown[]) => { drawn.push(a); }
      : (o as Record<string, unknown>)[k as string] ?? (() => {})),
    set: (o, k, v) => { (o as Record<string, unknown>)[k as string] = v; return true; },
  });

const loaded = (rgba: Uint8ClampedArray, w: number, h: number) => {
  const s = new Sampler();
  s.loadPixels(rgba, w, h);
  return s;
};

test('a fresh sampler reads nothing and says so', () => {
  const s = new Sampler();
  assert.equal(s.ready, false);
  assert.equal(s.sampleAt(0.5, 0.5), null);
  assert.equal(s.spreadAt(0.5, 0.5), 0);
  assert.deepEqual(s.suggest(), []);
  assert.equal(s.looksEdited(), null);
});

test('a flat field reads as that field', () => {
  const s = loaded(flat(INK.blue), 21, 21);
  assert.equal(s.ready, true);
  assert.equal(s.sampleAt(0.5, 0.5, 5), hexOf(INK.blue));
  assert.equal(s.spreadAt(0.5, 0.5, 5), 0, 'a flat patch has nothing to warn about');
});

test('one hot pixel in the patch does not move the reading', () => {
  const d = withSpeck(INK.blue, [255, 255, 255]);
  const s = loaded(d, 21, 21);
  assert.equal(s.sampleAt(0.5, 0.5, 5), hexOf(INK.blue), 'the median ignores the speck');
  assert.ok(s.spreadAt(0.5, 0.5, 5) > Sampler.EDGE_SPREAD, 'but the loupe still says "something sharp is here"');
});

test('a patch straddling an edge is reported as an edge, not a colour', () => {
  const s = loaded(edge(INK.blue, INK.yellow), 21, 21);
  assert.ok(s.spreadAt(0.5, 0.5, 5) > Sampler.EDGE_SPREAD, 'dead on the boundary');
  assert.equal(s.spreadAt(0.2, 0.5, 5), 0, 'well inside one side');
  assert.equal(s.spreadAt(0.8, 0.5, 5), 0, 'well inside the other');
});

test('a sample area cannot be placed where it would leave the photo', () => {
  const s = loaded(flat(INK.grey), 21, 21);
  // 21px wide, 5px patch: the centre may reach pixel 2..18, i.e. u from 0.1 to 0.9
  assert.equal(s.clampToSample(0, 0.5, 5).u, 0.1);
  assert.equal(s.clampToSample(1, 0.5, 5).u, 0.9);
  assert.equal(s.clampToSample(0.5, 0.5, 5).u, 0.5, 'a point inside the frame is left alone');
  // a bigger area is held back further, and no further than it needs to be
  assert.ok(s.clampToSample(0, 0.5, 32).u > s.clampToSample(0, 0.5, 5).u);
});

test('prominence gives the big field the vote', () => {
  const rgba = frame(60, 60, (x) => (x < 48 ? INK.blue : INK.yellow));
  const s = loaded(rgba, 60, 60);
  const p = s.prominence([{ id: 'c1', hex: hexOf(INK.blue) }, { id: 'c2', hex: hexOf(INK.yellow) }]);
  assert.ok(p.c1 > p.c2 * 3, `80% of the frame is blue, got ${p.c1} vs ${p.c2}`);
  assert.ok(Math.abs(p.c1 + p.c2 - 1) < 0.02, `the votes should add up, got ${p.c1 + p.c2}`);
});

test('suggested points report the colour they would actually read', () => {
  const rgba = quadrants([INK.blue, INK.yellow, INK.red, INK.green]);
  const s = loaded(rgba, 60, 60);
  const picks = s.suggest(5, 4, 8);
  assert.ok(picks.length >= 4 && picks.length <= 8, `count ${picks.length} must sit in the offered range`);
  for (const p of picks) {
    // the number the panel will print next to the dot has to be the dot's own reading
    assert.equal(p.hex, s.sampleAt(p.u, p.v, 5), `suggestion at ${p.u},${p.v} disagrees with its own sample`);
    const c = s.clampToSample(p.u, p.v, 5);
    assert.ok(Math.abs(c.u - p.u) < 1e-9 && Math.abs(c.v - p.v) < 1e-9, 'a suggestion must be placeable as-is');
  }
});

test('a one-colour frame still gets the floor of points, all reading the same colour', () => {
  const s = loaded(flat(INK.blue, 60, 60), 60, 60);
  const picks = s.suggest(5, 4, 8);
  assert.equal(picks.length, 4, 'the floor is the analysis floor');
  assert.ok(picks.every((p) => p.hex === hexOf(INK.blue)));
  const distinct = new Set(picks.map((p) => `${p.u.toFixed(3)},${p.v.toFixed(3)}`));
  assert.equal(distinct.size, 4, 'four points, four places — not the same spot four times');
});

test('the already-graded warning fires on a cast, not on a neutral frame', () => {
  assert.equal(loaded(flat(INK.grey, 60, 60), 60, 60).looksEdited(), null);
  assert.equal(loaded(flat(INK.yellow, 60, 60), 60, 60).looksEdited()?.cast, 'warm');
  assert.equal(loaded(flat(INK.blue, 60, 60), 60, 60).looksEdited()?.cast, 'cool');
});

test('blown-out whites are reported even with no colour cast', () => {
  const s = loaded(flat([252, 252, 252], 60, 60), 60, 60);
  const warn = s.looksEdited();
  assert.ok(warn, 'a frame that is all clipped highlight is worth a warning');
  assert.ok(warn.clipped > 0.5, `clipping should be reported as severe, got ${warn.clipped}`);
});

test('the hue map puts every hue where it actually is', () => {
  const pts = loaded(quadrants([INK.blue, INK.yellow, INK.red, INK.green], 60, 60), 60, 60).huePoints();
  const groups: number[][] = [];
  for (const p of pts) {
    const g = groups.find((g) => hueDist(p.hue, g[0]) < 40);
    if (g) g.push(p.hue); else groups.push([p.hue]);
  }
  assert.equal(groups.length, 4, `four quarters, four clusters — got ${groups.length}`);
  for (const g of groups) assert.ok(g.length > pts.length * 0.1, 'a quarter of the frame is not a rounding error');
});

test('a colour with no chroma has no place on the map', () => {
  // a grey pixel has a hue, but not one anybody could name; a cloud of them is a smear
  // through the middle that hides the shape of the photograph
  assert.equal(loaded(flat([128, 128, 128], 21, 21), 21, 21).huePoints().length, 0);
});

test('a pixel plots where its own colour sits on the wheel', () => {
  const blue = { r: 62, g: 99, b: 221 };
  const pts = loaded(flat([blue.r, blue.g, blue.b], 21, 21), 21, 21).huePoints();
  // the same two axes the wheel draws and `radiusFor` places dots by: one coordinate system
  assert.equal(pts[0].r, rgbToHsl(blue).s / 100);
  assert.equal(pts[0].hue, rgbToHsl(blue).h);
  assert.ok(pts[0].r > 0.5, 'a saturated colour reaches well out from the middle');
});

test('the cloud is capped, and the same frame gives the same cloud', () => {
  const big = loaded(frame(400, 400, () => INK.red), 400, 400);
  const pts = big.huePoints({ max: 200 });
  assert.ok(pts.length > 0 && pts.length <= 200, `capped at 200, got ${pts.length}`);
  assert.deepEqual(big.huePoints({ max: 200 }), pts, 'a photograph must not repaint differently each time');
});

test('a frame that came from a picture gives the loupe that picture to magnify', () => {
  // The loupe reads `canvas`, not `data`. When load() assigned the canvas and loadPixels()
  // then cleared it, every loupe in the app drew nothing: an empty ring with the page showing
  // through it, which looked like a magnifier pointed at the wrong place.
  const s = new Sampler();
  const source = { width: 21, height: 21 } as unknown as HTMLCanvasElement;
  const drawn: unknown[][] = [];
  s.loadPixels(flat([10, 140, 226], 21, 21), 21, 21, source);
  s.drawZoom(loupeCtx(drawn) as unknown as CanvasRenderingContext2D, 122, 0.5, 0.5, 5);
  assert.ok(drawn.length > 0, 'the loupe drew nothing from a frame that has a picture');
  assert.ok(drawn.every((a) => a[0] === source), 'the loupe magnified something other than its source');
});

test('a frame with no picture behind it draws no loupe rather than a blank one', () => {
  const s = new Sampler();
  const drawn: unknown[][] = [];
  s.loadPixels(flat([10, 140, 226], 21, 21), 21, 21);
  s.drawZoom(loupeCtx(drawn) as unknown as CanvasRenderingContext2D, 122, 0.5, 0.5, 5);
  assert.equal(drawn.length, 0);
});
