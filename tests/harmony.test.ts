import { test } from 'vitest';
import assert from 'node:assert/strict';
import { chromaRatio, deltaE, hexToHsl, hslDelta, hslToHex, hslToRgb, hueName, rgbToHex, retarget } from '../src/lib/color.ts';
import { clampAxis, median, patchRange } from '../src/lib/image.ts';
import { JND, detect, fit, suggestionText } from '../src/lib/harmonies.ts';
import { t } from '../src/i18n/index.ts';
import { REFERENCE, REFERENCE_EXPECTED as EXP } from './reference.ts';

const dots = REFERENCE.map((s) => ({ id: s.id, hex: s.hex, hue: hexToHsl(s.hex).h }));

test('hue naming matches the seven labelled reference samples', () => {
  for (const s of REFERENCE) assert.equal(hueName(s.hue), s.name, `hue ${s.hue} -> ${s.name}`);
});

test('HSL readout matches the reference panel', () => {
  for (const s of REFERENCE) {
    const h = hexToHsl(s.hex);
    assert.equal(Math.round(h.h), s.hue, s.id);
    assert.equal(Math.round(h.s), s.s, s.id);
    assert.equal(Math.round(h.l), s.l, s.id);
  }
});

test('reference photo is detected as Split-Complementary built around blue/orange/yellow-green', () => {
  const ranked = detect(dots);
  assert.equal(ranked[0].type, EXP.detected);
  assert.deepEqual(ranked[0].builtAround, EXP.builtAround);
  assert.ok(ranked[0].score >= 75 && ranked[0].score <= 95, `score was ${ranked[0].score}`);
});

test('split-complementary suggestions reproduce the reference output', () => {
  const f = fit('split-complementary', dots);
  const byId = Object.fromEntries(f.suggestions.map((s) => [s.id, s]));
  const aligned = f.suggestions.filter((s) => s.kind === 'aligned').map((s) => s.id);
  assert.deepEqual(aligned.sort(), EXP.split.aligned);
  for (const [id, word] of Object.entries(EXP.split.shiftToward)) {
    // The original printed a target for the two 1%-saturation greys as well. Those are
    // `inert` here: see the targetHex loop, which shows its suggestions were no-ops.
    if (byId[id].kind === 'inert') {
      assert.ok((byId[id].deltaE ?? 99) < JND, `${id} inert but ${byId[id].deltaE} apart`);
      continue;
    }
    assert.equal(byId[id].kind, 'shift', id);
    assert.match(suggestionText(byId[id], t), new RegExp(`^(Big shift|Shift) toward ${word}$`), id);
  }
  for (const [id, hue] of Object.entries(EXP.split.targetHue)) {
    assert.ok(Math.abs((byId[id].targetHue ?? -1) - hue) <= 3, `${id} target hue ${byId[id].targetHue} vs ${hue}`);
  }
  // suggested hexes must land within a hair of the reference values
  for (const [id, hex] of Object.entries(EXP.split.targetHex)) {
    const ref = REFERENCE.find((r) => r.id === id)!;
    if (byId[id].kind === 'inert') {
      // proof that `inert` costs nothing: what the original suggested for this grey is
      // indistinguishable from the grey it started as
      assert.ok(deltaE(ref.hex, hex) < JND, `${id}: ${ref.hex} vs the original's ${hex}`);
      continue;
    }
    const got = byId[id].targetHex ?? '#000000';
    for (let i = 0; i < 3; i++) {
      const a = parseInt(got.slice(1 + i * 2, 3 + i * 2), 16);
      const b = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
      assert.ok(Math.abs(a - b) <= 2, `${id} channel ${i}: ${got} vs ${hex}`);
    }
  }
});

test('analogous nudges the wall toward yellow-green and the flowers toward orange', () => {
  const f = fit('analogous', dots);
  const byId = Object.fromEntries(f.suggestions.map((s) => [s.id, s]));
  assert.deepEqual(f.suggestions.filter((s) => s.kind === 'aligned').map((s) => s.id).sort(), EXP.analogous.aligned);
  assert.equal(suggestionText(byId.c6, t), 'Big shift toward yellow-green');
  assert.equal(byId.c6.targetHex, EXP.analogous.targetHex.c6);
  // c1 is #777578 at 1% saturation: the original asked for a shift to orange, which the
  // 8-bit colour cannot express
  assert.equal(byId.c1.kind, 'inert');
  assert.equal(suggestionText(byId.c1, t), t('adj.inert'));
});

test('near-neutral colours are flagged as untrustworthy hues', () => {
  assert.ok(chromaRatio('#777578') < 0.06, 'c1 is grey');
  assert.ok(chromaRatio('#90908D') < 0.06, 'c5 is grey');
  assert.ok(chromaRatio('#F7D4AF') > 0.35, 'c4 is genuinely colourful');
});

test('retarget keeps lightness and chroma, only moves hue', () => {
  const out = retarget('#AFBBC5', 90);
  assert.equal(out, '#BAC5AF');
});

test('hslDelta reports slider-sized moves and takes the short way round the wheel', () => {
  const near = (a: number, b: number) => Math.abs(a - b) <= 1;
  const mk = (h: number, s: number, l: number) => hslToHex({ h, s, l });

  const same = hslDelta(mk(200, 40, 50), mk(200, 40, 50));
  assert.deepEqual([same.h, same.s, same.l], [0, 0, 0]);

  // 350° → 10° is +20, not −340: a slider should never be told to go the long way
  const wrap = hslDelta(mk(350, 80, 50), mk(10, 80, 50));
  assert.ok(near(wrap.h, 20), `wrap hue ${wrap.h}`);
  assert.ok(near(wrap.s, 0) && near(wrap.l, 0));

  const back = hslDelta(mk(10, 80, 50), mk(350, 80, 50));
  assert.ok(near(back.h, -20), `wrap hue ${back.h}`);

  const mixed = hslDelta(mk(120, 40, 30), mk(120, 70, 45));
  assert.ok(near(mixed.h, 0) && near(mixed.s, 30) && near(mixed.l, 15),
    `${mixed.h} ${mixed.s} ${mixed.l}`);
});

test('median ignores the speck in the patch and matches the mean on a flat one', () => {
  // a 5×5 patch of one colour, plus the single hot pixel that used to drag the mean
  const flat = Array(25).fill(120);
  assert.equal(median(flat), 120);
  const speck = [...flat]; speck[11] = 255;
  const mean = speck.reduce((a, b) => a + b, 0) / speck.length;
  assert.equal(median(speck), 120, 'one outlier must not move the reading');
  assert.ok(mean > 125, `the mean should have been dragged (it was ${mean.toFixed(1)})`);

  assert.equal(median([10, 20, 30, 40]), 25, 'even counts take the middle pair');
  assert.equal(median([]), 0);
  assert.equal(median([7]), 7);
});

test('every sample size reads exactly n×n pixels, centred or as close as even allows', () => {
  for (const n of [3, 5, 9, 16, 32]) {
    const { from, to } = patchRange(n);
    const side = to - from + 1;
    assert.equal(side, n, `${n}×${n} actually read ${side} wide`);
    // odd sizes centre on the pixel; even ones cannot, so they run one right and down
    assert.equal(from + to, n % 2 ? 0 : 1, `${n} is off-centre by the wrong amount`);
    assert.equal(side * side, n * n, `${n} patch area`);
  }
});

test('a sample point cannot be dragged where its area would leave the photo', () => {
  for (const size of [3, 5, 9, 16, 32]) {
    const { from, to } = patchRange(size);
    const n = 200;
    // pulled back exactly far enough: the whole patch is inside, not one pixel more
    assert.ok(clampAxis(0, n, size) * (n - 1) >= -from - 1e-9, `${size}: the left edge still overhangs`);
    assert.ok(clampAxis(1, n, size) * (n - 1) <= n - 1 - to + 1e-9, `${size}: the right edge still overhangs`);
    assert.ok(clampAxis(0, n, size) * (n - 1) - -from <= 1, `${size}: pulled back further than needed`);
    assert.ok(n - 1 - to - clampAxis(1, n, size) * (n - 1) <= 1, `${size}: pulled back further than needed`);
    assert.equal(clampAxis(0.5, n, size), 0.5, `${size}: a point that fits must not move`);
  }
  assert.equal(clampAxis(-3, 200, 5), clampAxis(0, 200, 5), 'out of range folds to the edge');
  assert.equal(clampAxis(0, 10, 32), 0.5, 'an area wider than the image centres instead of falling off');
  assert.equal(clampAxis(0, 1, 5), 0, 'a one-pixel axis has nowhere to go');
});

test('hslToRgb returns integers, and the round trip is stable', () => {
  let checked = 0;
  for (let h = 0; h < 360; h += 3) {
    for (let s = 0; s <= 100; s += 5) {
      for (let l = 0; l <= 100; l += 5) {
        const { r, g, b } = hslToRgb({ h, s, l });
        assert.ok(Number.isInteger(r) && Number.isInteger(g) && Number.isInteger(b), `${h}/${s}/${l} -> ${r},${g},${b}`);
        assert.ok(r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255);
        // a colour the wheel can name is a colour the wheel can read back unchanged
        assert.equal(rgbToHex(hslToRgb(hexToHsl(rgbToHex({ r, g, b })))), rgbToHex({ r, g, b }));
        checked++;
      }
    }
  }
  assert.ok(checked > 50000, `swept ${checked} colours`);
});
