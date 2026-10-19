/**
 * The wheel's geometry, asserted.
 *
 * Each of these was originally settled by looking at a Retina screenshot and arguing about
 * it: does the disc edge sit on the tick circle, does an arrowhead land on the target's rim,
 * do the six names sit the same distance from the edge when one language writes
 * "yellow-green" and another writes 黄绿. They are pure functions now, so they can be
 * checked instead of squinted at.
 */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { hexToHsl, wheelColor, wheelRgb } from '../src/lib/color.ts';
import {
  GHOST_R, LABEL_GAP, LABEL_HALF_H, LABELS, RIM, TICK,
  arcPath, connector, labelGeometry, polar,
} from '../src/lib/wheel.ts';

const C = 300, R = 238;

test('hue 0 is due east and the wheel turns counter-clockwise', () => {
  const e = polar(C, C, 0, R);
  assert.ok(Math.abs(e.x - (C + R)) < 1e-9 && Math.abs(e.y - C) < 1e-9, 'red to the right');
  const up = polar(C, C, 90, R);
  assert.ok(up.y < C - R + 1e-6 && Math.abs(up.x - C) < 1e-6, '90° is up, not down');
  const w = polar(C, C, 180, R);
  assert.ok(w.x < C - R + 1e-6, 'and 180° is due west');
  assert.deepEqual(polar(C, C, 137, 0), { x: C, y: C }, 'a radius of zero is the centre at any hue');
});

test('every rim label sits the same distance from the disc edge, whatever its width', () => {
  const narrow = { 'hue.red': 30, 'hue.yellow': 52, 'hue.green': 48, 'hue.cyan': 34, 'hue.blue': 34, 'hue.magenta': 66 };
  const wide = { 'hue.red': 44, 'hue.yellow': 92, 'hue.green': 84, 'hue.cyan': 50, 'hue.blue': 52, 'hue.magenta': 118 };
  const gaps = (widths: Record<string, number>) =>
    labelGeometry(C, C, R, widths).map((g) => {
      // the corner of the box nearest the centre, measured along the radius it sits on
      const reach = (widths[g.key] / 2) * Math.abs(g.ux) + LABEL_HALF_H * Math.abs(g.uy);
      return g.d - reach - R;
    });
  assert.deepEqual(gaps(narrow), gaps(wide), 'a translated, wider label must not crowd the rim');
  for (const gap of gaps(narrow)) assert.ok(Math.abs(gap - LABEL_GAP) < 1e-9, `gap was ${gap}`);
});

test('a tick starts on the disc edge and sticks out into the rim', () => {
  for (const g of labelGeometry(C, C, R, {})) {
    const a = Math.hypot(g.tickA.x - C, g.tickA.y - C);
    const b = Math.hypot(g.tickB.x - C, g.tickB.y - C);
    assert.ok(Math.abs(a - (R - 1)) < 1e-9, `${g.key} tick starts inside the disc: ${a}`);
    assert.ok(Math.abs(b - (R + TICK)) < 1e-9, `${g.key} tick stops in the rim: ${b}`);
  }
  assert.equal(labelGeometry(C, C, R, {}).length, LABELS.length);
});

test('the six names fit inside the box, in both languages', () => {
  // measured from the app's own font at 13.5px; the widest each label ever gets
  const en: Record<string, number> = { 'hue.red': 30, 'hue.yellow': 55, 'hue.green': 48, 'hue.cyan': 36, 'hue.blue': 36, 'hue.magenta': 70 };
  const zh: Record<string, number> = { 'hue.red': 30, 'hue.yellow': 30, 'hue.green': 30, 'hue.cyan': 30, 'hue.blue': 30, 'hue.magenta': 30 };
  const size = (R + RIM) * 2;
  for (const [name, widths] of [['en', en], ['zh', zh]] as const) {
    for (const g of labelGeometry(size / 2, size / 2, R, widths)) {
      const hw = (widths[g.key] ?? 26) / 2;
      assert.ok(g.x - hw >= 0 && g.x + hw <= size, `${name}/${g.key} is clipped horizontally`);
      assert.ok(g.y - LABEL_HALF_H >= 0 && g.y + LABEL_HALF_H <= size, `${name}/${g.key} is clipped vertically`);
    }
  }
});

test('an arrow starts on the chip and ends on the target rim', () => {
  const from = { x: 100, y: 100 };
  const to = { x: 300, y: 100 };
  const a = connector(from, to, 18, 16);
  assert.ok(Math.abs(Math.hypot(a.ax - from.x, a.ay - from.y) - 18) < 1e-9, 'starts on the chip edge');
  assert.ok(Math.abs(Math.hypot(a.bx - to.x, a.by - to.y) - 16) < 1e-9, 'the head lands on the rim');
  assert.ok(a.bx > a.ax, 'and it points from the dot toward the target');
});

test('two chips on top of each other get no arrow', () => {
  const a = connector({ x: 100, y: 100 }, { x: 112, y: 100 }, GHOST_R + 3, GHOST_R + 1);
  assert.equal(a.visible, false, 'a line shorter than its own padding would be drawn backwards');
  assert.equal(connector({ x: 100, y: 100 }, { x: 300, y: 100 }, GHOST_R, GHOST_R).visible, true);
});

test('the analogous wedge is the window, not what is left over', () => {
  const small = arcPath(C, C, R, 0, 60);
  const big = arcPath(C, C, R, 0, 200);
  assert.match(small, /A \d+ \d+ 0 0 0/, 'a 60° window takes the short way round');
  assert.match(big, /A \d+ \d+ 0 1 0/, 'a 200° span has to take the long way');
  assert.ok(small.startsWith(`M ${C} ${C}`), 'the wedge is closed at the centre');
});

test('the hue field is drawn from the model the dots are read on', () => {
  assert.deepEqual(wheelRgb(0, 0), { r: 255, g: 255, b: 255 }, 'the centre is white');
  assert.equal(wheelColor(0, 1), '#FF0000', 'the rim at 0° is a full red');
  assert.equal(wheelColor(120, 1), '#00FF00');
  assert.equal(wheelColor(240, 1), '#0000FF');
  assert.equal(wheelColor(0, 0.5), '#DF9F9F', 'halfway out is pale, not dark');
  // the model itself rather than a few samples of it: saturation grows outward, lightness
  // falls half as fast, which is what makes the disc's rim agree with a dot's HSL. The
  // tolerance is 8-bit rounding, not sloppiness — a pale colour has few bits to spare.
  for (const r of [0.2, 0.5, 0.8]) {
    const { s, l } = hexToHsl(wheelColor(200, r));
    assert.ok(Math.abs(s - r * 100) < 2.5, `saturation at radius ${r} was ${s}`);
    assert.ok(Math.abs(l - (100 - r * 50)) < 2.5, `lightness at radius ${r} was ${l}`);
  }
});
