import { test } from 'vitest';
import assert from 'node:assert/strict';
import { spreadPicks, type LabPoint } from '../src/lib/image.ts';

/** an n×n field of candidates spread over the whole frame, all sharing one colour */
function field(n: number, lab: Lab): LabPoint[] {
  const out: LabPoint[] = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) out.push({ u: (x + 0.5) / n, v: (y + 0.5) / n, ...lab });
  }
  return out;
}

type Lab = { L: number; a: number; b: number };

/**
 * A frame made of distinct colour patches, each in its own cell — like a real photo, where
 * a colour lives somewhere rather than everywhere. Spread every colour over the whole
 * frame and the greedy has no reason to prefer one patch over another.
 */
function frameWith(inks: Lab[], cells = 3): LabPoint[] {
  return inks.flatMap((lab, k) => {
    const cx = k % cells;
    const cy = Math.floor(k / cells);
    const out: LabPoint[] = [];
    const N = 5;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        out.push({
          u: (cx + (x + 0.5) / N) / cells,
          v: (cy + (y + 0.5) / N) / cells,
          ...lab,
        });
      }
    }
    return out;
  });
}

const INKS: Lab[] = [
  { L: 0.30, a: -0.30, b: -0.10 }, { L: 0.80, a: 0.20, b: 0.30 }, { L: 0.50, a: 0.30, b: -0.20 },
  { L: 0.60, a: -0.10, b: 0.35 }, { L: 0.40, a: 0.05, b: -0.35 }, { L: 0.90, a: -0.02, b: -0.05 },
  { L: 0.20, a: 0.25, b: 0.25 }, { L: 0.70, a: -0.35, b: 0.10 }, { L: 0.55, a: 0.12, b: 0.06 },
];

test('the count follows the frame: one point per colour left, clamped to 4–8', () => {
  assert.equal(spreadPicks(field(12, INKS[0]), 4, 8).length, 4,
    'one wall stops at the floor rather than inventing three more identical dots');

  assert.equal(spreadPicks(frameWith(INKS.slice(0, 2)), 4, 8).length, 4,
    'two colours in the frame still gets the floor — the floor is a floor');

  assert.equal(spreadPicks(frameWith(INKS.slice(0, 6)), 4, 8).length, 6,
    'six colours gets six points: the middle of the range is reachable, not just its ends');

  assert.equal(spreadPicks(frameWith(INKS), 4, 8).length, 8,
    'nine colours stops at the ceiling, not at nine');

  // and the limits are honoured rather than hardcoded
  assert.equal(spreadPicks(frameWith(INKS), 2, 3).length, 3);
  assert.equal(spreadPicks(field(12, INKS[0]), 6, 8).length, 6, 'the floor holds even when nothing new is left');
});

test('the same colour twice in the frame is one point, not two', () => {
  // the mirror-pose photo: identical yellow cuff on both paws, four other colours around it
  const mirrored = frameWith([INKS[0], INKS[1], INKS[2], INKS[3], INKS[0]]);
  const picked = spreadPicks(mirrored, 4, 8);
  const same = picked.filter((p) => Math.hypot(p.a - INKS[0].a, p.b - INKS[0].b) < 0.02).length;
  assert.equal(picked.length, 4, 'four colours, four points');
  assert.equal(same, 1, 'the second cuff is the same colour in a different place — not another sample');
});

test('spreadPicks never offers more points than the frame has', () => {
  assert.equal(spreadPicks([], 4, 8).length, 0);
  const few = field(2, { L: 0.5, a: 0, b: 0 });
  assert.equal(spreadPicks(few, 4, 8).length, few.length);
});

test('the first point is the most chromatic candidate', () => {
  const cands = [...field(6, { L: 0.5, a: 0.01, b: 0.01 }), ...field(6, { L: 0.5, a: 0.3, b: 0.2 })];
  const first = spreadPicks(cands, 4, 8)[0];
  assert.ok(Math.hypot(first.a, first.b) > 0.3, 'start from the strongest colour, not from a grey');
});
