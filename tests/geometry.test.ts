/**
 * Numeric invariants for every harmony, independent of the reference photograph.
 *
 * tests/harmony.test.ts pins the *values* the original tool produced for one photo.
 * That is not enough: six of the harmonies have geometric definitions that must hold
 * for any input, and every suggestion has to be arithmetically self-consistent —
 * the hue it names, the hex it prints and the slider numbers it prints must agree.
 */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  addHue, deltaE, hexToHsl, hexToOklch, hslDelta, hslToHex, hueDist, maxChromaAt,
  retarget, retargetRelative,
} from '../src/lib/color.ts';
import { suggestionText } from '../src/lib/harmonies.ts';
import { t } from '../src/i18n/index.ts';
import { ANALOGOUS_WINDOW, armCount, armTolerance, ARMS, detect, JND, minArms, OFFSETS, TOLERANCE, fit, hueGroups } from '../src/lib/harmonies.ts';
import type { Fit, FitDot, HarmonyType } from '../src/lib/harmonies.ts';

const AUTO = Object.keys(OFFSETS) as Exclude<HarmonyType, 'analogous' | 'custom'>[];

/** A colour with enough chroma for its hue to be a fact rather than rounding noise. */
const chip = (h: number) => hslToHex({ h, s: 62, l: 55 });
/** signed shortest rotation from a to b, in degrees */
const hueDeltaRaw = (a: number, b: number) => ((b - a + 540) % 360) - 180;

/** `n` saturated dots sitting exactly on the slots of a harmony anchored at `base`. */
function dotsOnSlots(type: Exclude<HarmonyType, 'analogous' | 'custom'>, base: number, locked = true): FitDot[] {
  return OFFSETS[type].map((off, i) => {
    const h = addHue(base, off);
    return { id: `s${i}`, hex: chip(h), hue: h, locked };
  });
}

test('every harmony builds the slots its name promises', () => {
  const base = 20;
  // a Record over HarmonyType, not a loose map: a new harmony that forgets its geometry
  // expectation is a compile error, which is the whole point of the table in harmonies.ts
  const expectations: Record<HarmonyType, (slots: number[]) => void> = {
    'monochromatic': (s) => assert.equal(s.length, 1),
    'complementary': (s) => assert.equal(hueDist(s[0], s[1]), 180),
    'triadic': (s) => {
      assert.equal(s.length, 3);
      assert.deepEqual([hueDist(s[0], s[1]), hueDist(s[1], s[2]), hueDist(s[0], s[2])], [120, 120, 120]);
    },
    'tetradic': (s) => {
      assert.equal(s.length, 4);
      const step = [hueDist(s[0], s[1]), hueDist(s[1], s[2]), hueDist(s[2], s[3]), hueDist(s[3], s[0])];
      assert.deepEqual(step, [90, 90, 90, 90]);
    },
    // two complementary pairs; the gap between the pairs is what tells them apart
    'rectangle': (s) => {
      assert.equal(s.length, 4);
      assert.deepEqual([hueDist(s[0], s[1]), hueDist(s[1], s[2]), hueDist(s[2], s[3]), hueDist(s[3], s[0])], [60, 120, 60, 120]);
    },
    'double-split-complementary': (s) => {
      assert.equal(s.length, 4);
      assert.deepEqual([hueDist(s[0], s[1]), hueDist(s[1], s[2]), hueDist(s[2], s[3]), hueDist(s[3], s[0])], [30, 150, 30, 150]);
    },
    'analogous': (s) => {
      assert.equal(s.length, 2, 'a window is two edges');
      assert.equal(hueDist(s[0], s[1]), ANALOGOUS_WINDOW);
    },
    'custom': (s) => assert.equal(s.length, 0, 'a hand-drawn skeleton brings its own slots'),
    'split-complementary': (s) => {
      assert.equal(s.length, 3);
      // base + the two neighbours of its complement: 150 and 210, i.e. ±30 around 180
      assert.deepEqual([hueDist(s[0], s[1]), hueDist(s[0], s[2]), hueDist(s[1], s[2])], [150, 150, 60]);
    },
  };

  for (const type of AUTO) {
    const f = fit(type, dotsOnSlots(type, base));
    expectations[type](f.slots);
    for (const h of f.slots) assert.ok(h >= 0 && h < 360, `${type} slot ${h} out of range`);
  }

  const a = fit('analogous', dotsOnSlots('monochromatic', base));
  assert.ok(a.window, 'analogous must expose a window');
  assert.equal(((a.window![1] - a.window![0]) + 360) % 360, ANALOGOUS_WINDOW);
});

test('a dot sitting on each slot is aligned, scores 100 and asks for no change', () => {
  for (const type of AUTO) {
    const f = fit(type, dotsOnSlots(type, 200));
    const kinds = f.suggestions.map((s) => s.kind);
    assert.ok(kinds.every((k) => k === 'aligned'), `${type}: ${kinds.join(',')}`);
    assert.equal(f.driftMean, 0, `${type} drift`);
    assert.equal(f.score, 100, `${type} score`);
    for (const s of f.suggestions) {
      assert.equal(s.targetHex, undefined, `${type} must not print a target when aligned`);
      assert.equal(s.deltaE, undefined, `${type} must not print a delta when aligned`);
    }
  }
});

test('a dot pushed outside tolerance is pulled back to the slot it left, by that many degrees', () => {
  const base = 140;
  for (const type of AUTO) {
    // one locked dot on the base slot holds the skeleton in place for every type,
    // including monochromatic where the base slot is the only one there is
    const dots: FitDot[] = [
      { id: 'anchor', hex: chip(base), hue: base, locked: true },
      ...dotsOnSlots(type, base).slice(1),
    ];
    // how far is "off the arm" depends on how tightly the arms are spaced: double-split puts
    // them 30° apart, where a 30° excursion simply lands on the next one
    const push = armTolerance(fit(type, dots).slots) + 5;
    const moved = addHue(base, push);
    dots.push({ id: 'moved', hex: chip(moved), hue: moved });
    const f = fit(type, dots);
    const s = f.suggestions.find((x) => x.id === 'moved')!;

    assert.equal(s.kind, 'shift', `${type}: a ${push}° excursion must be a shift (tolerance ${armTolerance(f.slots)})`);
    assert.equal(Math.abs(s.delta ?? 0), push, `${type} delta ${s.delta}`);
    // the sign must point the short way round the wheel, back to the nearest slot
    assert.equal(Math.sign(s.delta ?? 0), -1, `${type} must move back toward the anchor`);
    assert.ok(hueDist(s.targetHue ?? -1, base) <= 1, `${type} target ${s.targetHue} vs slot ${base}`);

    // the printed hex must be the printed hue — no drift between the two read-outs
    assert.equal(s.targetHex, retarget(chip(moved), s.targetHue!), `${type} hex/hue disagree`);
    assert.ok((s.deltaE ?? 0) > 0, `${type} must report a distance`);
  }
});

test('hue-only mode: the slider numbers agree with the suggested hex, the short way round', () => {
  const cases: [string, number][] = [['#F7D4AF', 205], ['#295B85', 20], ['#C9B9A8', 300], ['#3F4040', 175]];
  for (const [hex, target] of cases) {
    const to = retarget(hex, target);
    const d = hslDelta(hex, to);
    const from = hexToHsl(hex);
    assert.ok(Math.abs(d.h) <= 180, `${hex}->${target}: ${d.h} is not the short way`);
    // hue-only retargeting keeps the other two sliders where they are
    assert.deepEqual([d.s, d.l], [0, 0], `${hex}->${target}`);
    // applying the printed number to the current hue must land on the printed target —
    // unless the colour has no chroma to carry it, which is what `inert` exists for
    const expressible = deltaE(hex, to) >= JND;
    if (expressible) {
      assert.ok(Math.abs(d.h - hueDeltaRaw(from.h, target)) <= 1, `${hex}->${target}: ${d.h}`);
      assert.ok(hueDist(addHue(from.h, d.h), target) <= 1, `${hex}->${target}: applying ${d.h}° misses`);
    } else {
      assert.equal(d.h, 0, `${hex}->${target}: an unexpressible move must not print degrees`);
    }
  }
});

test('relative mode keeps lightness and keeps each colour as loud for its new hue', () => {
  const loudness = (hex: string) => {
    const { l, c, h } = hexToOklch(hex);
    return c / maxChromaAt(l, h);
  };
  for (const [hex, target] of [['#F7D4AF', 205], ['#295B85', 20], ['#C9B9A8', 300], ['#287367', 45]] as [string, number][]) {
    const to = retargetRelative(hex, target);
    assert.ok(deltaE(hex, to) > JND, `${hex}->${target} should be a real move`);
    // lightness is the structure of a photograph: preserved
    // HSL lightness is the parameter held still (that is what the slider reads), so OKLab
    // lightness moves a little — HSL L is not perceptual lightness. It stays close.
    assert.ok(Math.abs(hexToOklch(hex).l - hexToOklch(to).l) < 0.05, `${hex}->${target} lightness drifted`);
    // and the colour stays as intense *for its hue* instead of keeping a meaningless S
    assert.ok(Math.abs(loudness(hex) - loudness(to)) < 0.05, `${hex}->${target} loudness ${loudness(hex)} vs ${loudness(to)}`);
  }

  // the whole point: this is where the S and L numbers come from. Their sign is not the
  // point — HSL saturation is not chroma, so the same loudness can need more or less of it
  // depending on which hue you rotated to.
  for (const [hex, target] of [['#F7D4AF', 205], ['#287367', 45]] as [string, number][]) {
    const d = hslDelta(hex, retargetRelative(hex, target));
    assert.ok(d.s !== 0 || d.l !== 0, `${hex}->${target} still prints nothing but a hue`);
  }
});

test('the mode changes the suggested colour but never the fit', () => {
  for (const type of AUTO) {
    const dots = dotsOnSlots(type, 100);
    const offHue = addHue(100, armTolerance(fit(type, dots).slots) + 5);
    dots.push({ id: 'off', hex: chip(offHue), hue: offHue });
    const a = fit(type, dots, 'hue');
    const b = fit(type, dots, 'relative');
    assert.equal(a.score, b.score, `${type} score must not depend on the mode`);
    assert.deepEqual(a.slots, b.slots, `${type} slots`);
    const off = (f: typeof a) => f.suggestions.find((x) => x.id === 'off')!;
    assert.notEqual(off(a).targetHex, off(b).targetHex, `${type} the two modes should differ`);
  }
});

test('the colour a suggestion prints always reads as the hue the suggestion names', () => {
  // HSL hue and OKLCh hue are different scales (#AFBBC5 is HSL 207° but OKLCh 243°), and the
  // wheel, the slot table and the hue names are all HSL. A suggestion that quietly lands on
  // the wrong scale tells someone to move a slider that does not match the swatch.
  const sources = ['#AFBBC5', '#F7D4AF', '#295B85', '#287367', '#C9B9A8', '#192113', '#EE8760'];
  for (const mode of ['hue', 'relative'] as const) {
    for (const hex of sources) {
      for (let target = 0; target < 360; target += 30) {
        const to = mode === 'relative' ? retargetRelative(hex, target) : retarget(hex, target);
        const read = hexToHsl(to).h;
        // 3°, not 0°: an 8-bit colour at low chroma cannot hold an exact hue, and the hue
        // buckets the UI names are 20-30° wide, so this slack can never change the word
        assert.ok(hueDist(read, target) <= 3, `${mode} ${hex}->${target} gives ${to}, which reads ${read.toFixed(1)}°`);
        if (hueDist(read, target) > 0.6) {
          // a colour this muted cannot carry an exact hue; the suggestion must still be the
          // closest expressible one, never a different family
          assert.ok(hueDist(read, target) <= 3, `${mode} ${hex}->${target} = ${to} reads ${read.toFixed(1)}°`);
        }
      }
    }
  }
});

test('relative mode never asks for a lightness change, because HSL L is the parameter it holds', () => {
  for (const [hex, target] of [['#F7D4AF', 205], ['#287367', 45], ['#C9B9A8', 300]] as [string, number][]) {
    assert.equal(hslDelta(hex, retargetRelative(hex, target)).l, 0, `${hex}->${target}`);
  }
});

test('an unseeable move is reported as inert, not as an instruction', () => {
  const dots: FitDot[] = [
    { id: 'anchor', hex: chip(200), hue: 200, locked: true },
    { id: 'grey', hex: '#3F4040', hue: 180 },
  ];
  for (const mode of ['hue', 'relative'] as const) {
    const s = fit('complementary', dots, mode).suggestions.find((x) => x.id === 'grey')!;
    assert.equal(s.kind, 'inert', `${mode}: ${s.kind} ΔE ${s.deltaE}`);
    assert.equal(s.targetHex, undefined, `${mode}: an inert row must not print a colour`);
    assert.equal(s.magnitude, undefined, `${mode}: an inert row has no size`);
    assert.equal(suggestionText(s, t), t('adj.inert'));
    assert.ok((s.deltaE ?? 99) < JND);
  }
});

test('a suggestion is never allowed to ask for a change nobody can see', () => {
  // #3F4040 is RGB(63,64,64): its "hue" is a 1/255 rounding artifact, and rotating it
  // produces the same 8-bit colour. Telling someone to move it is not advice.
  const inert = retarget('#3F4040', 175);
  assert.ok(deltaE('#3F4040', inert) < 1, 'fixture: this move really is invisible');

  for (const type of AUTO) {
    const dots: FitDot[] = [
      ...dotsOnSlots(type, 20),
      { id: 'grey1', hex: '#3F4040', hue: 180 },
      { id: 'grey2', hex: '#777578', hue: 280 },
      { id: 'grey3', hex: '#221C16', hue: 28 },
    ];
    const f = fit(type, dots);
    for (const s of f.suggestions) {
      if (s.kind !== 'shift') continue;
      assert.ok((s.deltaE ?? 0) >= 1,
        `${type}: ${s.id} asks for a ΔE ${s.deltaE?.toFixed(2)} move — invisible`);
    }
  }
});

test('one locked colour defines the skeleton instead of being fitted to it', () => {
  // the other dots stay unlocked: one pin must win over their combined pull
  const dots: FitDot[] = [...dotsOnSlots('complementary', 200, false), { id: 'pin', hex: chip(345), hue: 345, locked: true }];
  const f = fit('complementary', dots, 'relative');
  assert.ok(f.slots.some((s) => hueDist(s, 345) <= 1), `slots ${f.slots.map(Math.round)} should hold the lock`);
  assert.equal(f.suggestions.find((s) => s.id === 'pin')!.kind, 'aligned');
});

test('a locked colour is never asked to move, even when the locks contradict each other', () => {
  for (const type of AUTO) {
    // two pins that no skeleton of this type can carry at the same time
    const dots: FitDot[] = [
      { id: 'lockA', hex: chip(140), hue: 140, locked: true },
      { id: 'lockB', hex: chip(10), hue: 10, locked: true },
    ];
    const f = fit(type, dots, 'relative');
    for (const s of f.suggestions) {
      assert.notEqual(s.kind, 'shift', `${type}: locked ${s.id} was told to move`);
      assert.ok(s.kind === 'aligned' || s.kind === 'locked', `${type}: ${s.id} = ${s.kind}`);
    }
    const off = f.suggestions.find((s) => s.kind === 'locked');
    if (off) {
      assert.ok(Math.abs(off.delta ?? 0) > TOLERANCE, `${type}: reported ${off.delta}° is inside tolerance`);
      assert.equal(off.targetHex, undefined, `${type}: a lock must not print a target colour`);
    }
  }
});

/* ---------------------------------------------------------- arms: a harmony needs company */

const at = (id: string, hue: number, hex = hslToHex({ h: hue, s: 60, l: 55 })): FitDot => ({ id, hex, hue });

/** where the dots would actually stand once the suggestions are applied */
function occupiedArms(f: Fit, dots: FitDot[]): number {
  const arms = new Set<number>();
  for (const s of f.suggestions) {
    if (s.kind === 'ignored') continue;
    const hue = s.targetHue ?? dots.find((d) => d.id === s.id)!.hue;
    const slot = f.slots.reduce((best, s2) => (hueDist(hue, s2) < hueDist(hue, best) ? s2 : best), f.slots[0]);
    if (hueDist(hue, slot) <= TOLERANCE) arms.add(Math.round(((slot % 360) + 360) % 360));
  }
  return arms.size;
}

test('hueGroups counts colours on a circle, not on a number line', () => {
  assert.equal(hueGroups([355, 5]), 1, '355 and 5 are the same neighbourhood');
  assert.equal(hueGroups([0, 90, 180, 270]), 4);
  assert.equal(hueGroups([0, 10, 20]), 1, 'a chain where each hue touches the next is one group');
  assert.equal(hueGroups([0, 0, 0]), 1, 'the same hue twice is not two groups');
  assert.equal(hueGroups([]), 0);
});

test('a tetradic needs four hues, not one yellow sampled in four places', () => {
  const one = [at('c1', 44), at('c2', 46), at('c3', 42), at('c4', 47)];
  const f = fit('tetradic', one);
  assert.equal(f.arms.ok, false);
  assert.equal(f.arms.reason, 'arms', 'four points, one colour: three arms would have to be invented');
  assert.equal(f.score, 0, 'zero drift is not a fit when there is only one colour to place');
  const offered = detect(one).map((x) => x.type);
  assert.ok(!offered.includes('tetradic'), 'a one-hue photo is never sold a tetradic');
  assert.ok(!offered.includes('triadic'), offered.join(','));
  assert.ok(offered.includes('complementary'), 'one hue plus one move is a legitimate complement');
  assert.ok(offered.includes('monochromatic'), 'monochromatic is always staffable');
});

test('two opposing colours buy a complementary, not a square', () => {
  const pair = [at('c1', 20), at('c2', 200), at('c3', 22), at('c4', 198)];
  assert.equal(fit('tetradic', pair).arms.reason, 'arms');
  assert.equal(fit('tetradic', pair).score, 0);
  const comp = fit('complementary', pair);
  assert.deepEqual([comp.arms.ok, comp.arms.have], [true, 2]);
  assert.ok(comp.score > 80, `a real complementary pair should score well, got ${comp.score}`);
});

test('three groups enter a tetradic, and the moves leave four hues behind', () => {
  // the case that matters: one colour appears twice, so one of them can open the empty arm
  const three = [at('c1', 10), at('c2', 100), at('c3', 190), at('c4', 12)];
  const f = fit('tetradic', three);
  assert.ok(f.arms.ok, `a reachable tetradic must still be offered, got ${JSON.stringify(f.arms)}`);
  assert.equal(f.score > 0, true);
  const fill = f.suggestions.filter((s) => s.fillsEmpty);
  assert.equal(fill.length, 1, 'exactly one move opens the arm nobody was standing on');
  assert.equal(fill[0].kind, 'shift', 'and it is a real instruction, not a suggestion of a slot');
  assert.equal(occupiedArms(f, three), 4, 'the answer has to end with four hues, not three');
});

test('four arms need four points: three dots can never become four hues', () => {
  const three = [at('c1', 10), at('c2', 100), at('c3', 190)];
  const f = fit('tetradic', three);
  assert.equal(f.arms.ok, false);
  assert.equal(f.arms.reason, 'dots', 'three groups, but nothing left to stand on the fourth arm');
  assert.equal(f.score, 0);
  assert.ok(!detect(three).some((x) => x.type === 'tetradic'));
  // the same three dots are a perfectly good triad
  assert.ok(detect(three).some((x) => x.type === 'triadic'));
});

test('four hues 90 apart are a tetradic', () => {
  const four = [at('c1', 10), at('c2', 100), at('c3', 190), at('c4', 280)];
  const f = fit('tetradic', four);
  assert.ok(f.arms.ok);
  assert.deepEqual([f.arms.have, f.arms.dots, f.arms.slots], [4, 4, 4]);
  assert.ok(f.score > 85);
  assert.equal(occupiedArms(f, four), 4);
});

test('the four-arm family is three different rectangles', () => {
  assert.deepEqual(OFFSETS['tetradic'], [0, 90, 180, 270]);
  assert.deepEqual(OFFSETS['rectangle'], [0, 60, 180, 240]);
  assert.deepEqual(OFFSETS['double-split-complementary'], [0, 30, 180, 210]);
  // rectangle and double split are both two complementary pairs; a tetradic is not
  for (const type of ['rectangle', 'double-split-complementary'] as const) {
    const f = fit(type, dotsOnSlots(type, 210, false));
    const pairs = f.slots.filter((s) => f.slots.some((o) => hueDist(o, addHue(s, 180)) <= 1));
    assert.equal(pairs.length, 4, `${type}: every slot should have its complement opposite`);
  }
  const sq = fit('tetradic', dotsOnSlots('tetradic', 210, false));
  assert.equal(sq.slots.filter((s) => sq.slots.some((o) => hueDist(o, addHue(s, 180)) <= 1)).length, 4,
    'a tetradic pairs up too — 90° apart is still two complementary pairs');
});

test('every offered harmony ends with as many arms as it names', () => {
  const crowded = [at('c1', 8), at('c2', 12), at('c3', 95), at('c4', 188), at('c5', 275), at('c6', 300)];
  for (const type of AUTO) {
    const f = fit(type, crowded);
    if (!f.arms.ok || type === 'monochromatic') continue;
    assert.equal(
      occupiedArms(f, crowded), Math.min(ARMS[type], crowded.length),
      `${type}: occupied ${occupiedArms(f, crowded)} of ${ARMS[type]} arms`,
    );
  }
});

test('greys are not arms, and a grey frame is never left with nothing to choose', () => {
  const greys = [at('c1', 0, '#2b2b2b'), at('c2', 120, '#7a7a7a'), at('c3', 240, '#cfcfcf')];
  assert.equal(armCount(greys), 1, 'no chromatic dot still counts as one group, not zero');
  assert.equal(fit('tetradic', greys).score, 0);
  assert.ok(detect(greys).some((f) => f.type === 'monochromatic'));
});

test('an ignored dot stops being an arm and stops being a body', () => {
  const four = [at('c1', 10), at('c2', 100), at('c3', 190), { ...at('c4', 280), ignored: true }];
  assert.equal(armCount(four), 3);
  const f = fit('tetradic', four);
  assert.equal(f.arms.reason, 'dots', 'three colours left, but only three bodies for four arms');
  assert.equal(f.arms.dots, 3);
});

test('every harmony declares its arms and the two thresholds that follow', () => {
  assert.deepEqual(ARMS, {
    monochromatic: 1, analogous: 2, complementary: 2, 'split-complementary': 3,
    triadic: 3, 'double-split-complementary': 4, tetradic: 4, rectangle: 4, custom: 0,
  });
  assert.equal(minArms('tetradic'), 3);
  assert.equal(minArms('triadic'), 2);
  assert.equal(minArms('complementary'), 1);
  assert.equal(minArms('monochromatic'), 0);
  assert.equal(minArms('custom'), 0, 'a skeleton the user drew is legal by construction');
});
