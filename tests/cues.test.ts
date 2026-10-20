/**
 * The three reading aids in `lib/cues.ts`, pinned.
 *
 * These are the places where the app says something about a photograph that the harmony maths
 * did not compute, so each one needs its boundary drawn in a test: what triggers it, and just as
 * importantly what does not. A reading aid that fires on everything is an advertisement.
 */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  HUE_BANDS, aerialHazard, hueBand, lightBand, memoryFamily, memoryLeft,
} from '../src/lib/cues.ts';

test('memory colours are named by the thing, and a move inside the band is not a loss', () => {
  assert.equal(memoryFamily(212), 'sky');
  assert.equal(memoryFamily(200), 'sky');
  assert.equal(memoryFamily(26), 'skin');
  assert.equal(memoryFamily(100), 'foliage');
  assert.equal(memoryFamily(300), null, 'nobody holds a memory colour for magenta');
  assert.equal(memoryFamily(0), null);

  // the warning is about leaving, not about being asked
  assert.equal(memoryLeft(212, 30), 'sky', 'a sky blue turned orange is a sky lost');
  assert.equal(memoryLeft(212, 200), null, 'a sky blue nudged along the sky is nothing');
  assert.equal(memoryLeft(26, 212), 'skin');
  assert.equal(memoryLeft(100, 160), null, 'the foliage band is wide on purpose');
  assert.equal(memoryLeft(300, 30), null, 'nothing to leave if nothing was remembered');
});

test('a hue band is named the way an editor names its slider', () => {
  assert.equal(hueBand(0), 'reds');
  assert.equal(hueBand(350), 'reds', 'the reds slider wraps around the wheel');
  assert.equal(hueBand(20), 'oranges');
  assert.equal(hueBand(50), 'yellows');
  assert.equal(hueBand(100), 'greens');
  assert.equal(hueBand(180), 'aquas');
  assert.equal(hueBand(212), 'blues');
  assert.equal(hueBand(270), 'purples');
  assert.equal(hueBand(300), 'magentas');

  // every hue lands in exactly one band, or the scope line would sometimes lie or say nothing
  for (let h = 0; h < 360; h++) {
    const hits = HUE_BANDS.filter((b) => (b.from <= b.to
      ? h >= b.from && h < b.to
      : h >= b.from || h < b.to));
    assert.equal(hits.length, 1, `hue ${h} landed in ${hits.length} bands`);
    assert.equal(hits[0].key, hueBand(h));
  }
});

test('lightness bands break where a photographer says shadows and highlights', () => {
  assert.equal(lightBand('#111111'), 'shadows');
  assert.equal(lightBand('#808080'), 'midtones');
  assert.equal(lightBand('#cccccc'), 'highlights');
  assert.equal(lightBand('#ffffff'), 'highlights');
  // a dark colour keeps its lightness band whatever its hue
  assert.equal(lightBand('#123a6b'), 'shadows');
});

test('the haze reading needs a distance-shaped colour over a large share of the frame', () => {
  const haze = '#9FB6C9';
  assert.ok(aerialHazard(haze, 0.3), 'low chroma, bright, cool, and most of the frame');
  assert.ok(aerialHazard('#7FA0BC', 0.3), 'a slightly stronger haze still counts');
  assert.ok(!aerialHazard(haze, 0.05), 'the same colour in a corner is a colour, not distance');

  // the readings this must not fire on, each for a different reason
  assert.ok(!aerialHazard('#1E5FA8', 0.6), 'a saturated blue is an object, not the far distance');
  assert.ok(!aerialHazard('#E8C39E', 0.6), 'bright and warm is sunlit, not atmospheric');
  assert.ok(!aerialHazard('#F2F2F2', 0.6), 'no chroma at all is the near-neutral message, not this one');
  assert.ok(!aerialHazard('#5C6B7A', 0.6), 'a dark cool grey is shade, not distance');
});
