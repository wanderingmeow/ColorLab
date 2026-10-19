/**
 * The layer that decides what the user is told.
 *
 * `analysis.ts` sits between the engine and the screen: it turns the current samples into a
 * ranking, picks the automatic answer, and honours an explicit choice. Until now the
 * reference reproduction called `detect()` directly and this layer had no test at all —
 * which is how the rule that keeps the rectangle family out of auto-detection could be
 * deleted tomorrow and nothing would notice.
 */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { createRoot } from 'solid-js';
import { activeFit, activeType, customReadout, detected, fitDots, ranked } from '../src/lib/analysis.ts';
import { samples, setCustomHue, setHarmony, setSelected, setSamples, updateSample } from '../src/lib/store.ts';
import { hexToHsl, hslToHex } from '../src/lib/color.ts';
import { AUTO_DETECT } from '../src/lib/harmonies.ts';
import type { HarmonyType } from '../src/lib/harmonies.ts';
import { REFERENCE, REFERENCE_EXPECTED as EXP } from './reference.ts';

const chip = (h: number) => hslToHex({ h, s: 62, l: 55 });
const dotsOf = (hexes: string[]) => hexes.map((hex, i) => ({
  id: `c${i + 1}`, label: '', hex, x: 0.5, y: 0.5, locked: false, ignored: false,
}));
const reference = () => REFERENCE.map((s) => ({
  id: s.id, label: s.label, hex: s.hex, x: 0.5, y: 0.5, locked: false, ignored: false,
}));

/** every store signal this file writes is reset by disposing the root's computations */
function withSamples<T>(samples: ReturnType<typeof dotsOf>, body: () => T): T {
  let out!: T;
  createRoot((dispose) => {
    try {
      setSamples(samples);
      setHarmony('auto');
      out = body();
    } finally {
      dispose();
    }
  });
  return out;
}

test('the reference photograph answers through the layer the app actually uses', () => {
  withSamples(reference(), () => {
    const top = detected();
    assert.equal(top?.type, EXP.detected);
    assert.deepEqual(top?.builtAround, EXP.builtAround);
    assert.ok(top && top.score >= 75 && top.score <= 95, `score was ${top?.score}`);
    assert.equal(activeType(), EXP.detected, 'the panel shows what was detected, not a fallback');
  });
});

test('a rectangle can outscore the answer and still not be volunteered', () => {
  // dots sitting exactly on a 0/60/180/240 skeleton: nothing else can fit them this well
  const skeleton = dotsOf([0, 60, 180, 240].map(chip));
  withSamples(skeleton, () => {
    const all = ranked();
    const best = all[0];
    assert.equal(best.type, 'rectangle', `the rectangle should win on score, got ${best.type}`);
    const top = detected();
    assert.ok(top, 'something must still be detected');
    assert.ok(AUTO_DETECT.includes(top!.type), `${top!.type} is not allowed to be picked automatically`);
    assert.notEqual(top!.type, 'rectangle');
    assert.ok(all.some((f) => f.type === 'rectangle' && f.score > 0), 'it is still scored, for the picker');
  });
});

test('an explicit choice beats the automatic answer', () => {
  withSamples(dotsOf([0, 60, 180, 240].map(chip)), () => {
    const auto = activeType();
    setHarmony('rectangle');
    assert.equal(activeType(), 'rectangle');
    assert.equal(activeFit()?.type, 'rectangle', 'the panel must show the chosen skeleton, not the detected one');
    setHarmony('auto');
    assert.equal(activeType(), auto, 'and go back when the choice is released');
  });
});

test('a harmony the samples cannot carry is not offered at all', () => {
  // one yellow, four times: the maths loves a four-arm skeleton that everything already sits on
  const oneHue = dotsOf([44, 46, 42, 47].map(chip));
  withSamples(oneHue, () => {
    const offered = ranked().map((f) => f.type);
    for (const four of ['tetradic', 'rectangle', 'double-split-complementary'] as HarmonyType[]) {
      assert.ok(!offered.includes(four), `${four} was offered for a one-colour photo`);
    }
    assert.ok(offered.includes('monochromatic'), 'there must always be something selectable');
  });
});

test('custom mode has no skeleton of its own but still names the structure', () => {
  withSamples(dotsOf([0, 120, 240].map(chip)), () => {
    setHarmony('custom');
    assert.equal(activeType(), 'custom');
    assert.equal(activeFit(), null, 'the user drew the skeleton; there is nothing to fit');
    const read = customReadout();
    assert.ok(read, 'the read-out should still say what the layout looks like');
    assert.ok(read.score > 0, `a triad drawn by hand should read as one, got ${read.score}`);
  });
});

test('a hand-placed skeleton is scored on the targets, not on the colours that happen to be there', () => {
  // three dots that are all roughly the same orange: nothing interesting until targets are placed
  withSamples(dotsOf([20, 30, 40].map(chip)), () => {
    setHarmony('custom');
    setCustomHue({ c1: 0, c2: 120, c3: 240 });
    const read = customReadout();
    assert.equal(read?.type, 'triadic', `three targets a third apart should read as a triad, got ${read?.type}`);
    assert.ok(read && read.score >= 90, `a triad drawn dead-on should score high, got ${read?.score}`);
  });
});

/* ---------------------------------------------------------------- the fit cache */

test('the ranking is computed once per set of samples, not once per read', () => {
  withSamples(reference(), () => {
    const first = ranked();
    const second = ranked();
    assert.equal(first[0], second[0], 'the same scored object: nothing was rescanned');
    assert.equal(activeFit(), second.find((f) => f.type === activeType()),
      'the panel and the wheel read the one fit, not two that happen to agree');
  });
});

test('the cache notices what it is supposed to notice', () => {
  withSamples(reference(), () => {
    const before = ranked()[0];
    // selecting a dot changes nothing about the colours, so the answer must not move
    setSelected(samples()[0].id);
    assert.equal(ranked()[0], before, 'a selection is not a new photograph');

    // locking a dot pins the skeleton: that is a new constraint and has to be re-scanned
    updateSample('c2', { locked: true });
    assert.notEqual(ranked()[0], before, 'the lock has to be re-scored, not replayed from cache');
  });
});

test('the cache notices a colour that changed under a point', () => {
  withSamples(dotsOf([0, 60, 180, 240].map(chip)), () => {
    const before = ranked()[0];
    assert.equal(before.type, 'rectangle', 'four hues on four arms: a textbook rectangle');
    updateSample('c3', { hex: chip(62) });     // the 180° arm is now empty
    const after = ranked()[0];
    assert.notEqual(after, before, 'a re-sampled point has to be re-scored');
    // Three hue groups still staff a rectangle — an empty arm is filled by a duplicate, on
    // purpose, so the name stays true to what you end with. What the move costs is visible
    // in the drift, and that is the honest thing to assert here: this test once passed on a
    // leaked Custom intent making the geometry look broken, and asserted the wrong answer.
    assert.ok(after.driftMean > before.driftMean,
      `the duplicated arm has to travel: drift ${before.driftMean.toFixed(1)} → ${after.driftMean.toFixed(1)}`);
  });
});

test('a hue placed in Custom mode stops steering the other harmonies', () => {
  const hexes = [chip(10), chip(180), chip(210), chip(30)];
  withSamples(dotsOf(hexes), () => {
    const ids = samples().map((s) => s.id);
    // an intent: "take the first dot to 300°"
    setCustomHue({ [ids[0]]: 300 });

    setHarmony('custom');
    assert.equal(fitDots()[0].hue, 300, 'in Custom mode the skeleton follows the intent');

    setHarmony('split-complementary');
    assert.ok(Math.abs(fitDots()[0].hue - hexToHsl(hexes[0]).h) < 0.5,
      'leave Custom and the arrangement is gone: the fit reads the colour the dot has. '
      + 'Otherwise the wheel shows one colour while the panel asks you to move it toward another');

    setHarmony('auto');
    setCustomHue({});
  });
});
