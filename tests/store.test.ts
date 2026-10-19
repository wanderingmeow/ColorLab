import { test } from 'vitest';
import assert from 'node:assert/strict';
import { createRoot } from 'solid-js';
import {
  addSample, clearCustomHue, dots, removeSample, samples, sampleNumber, setCustomHue, setSamples,
} from '../src/lib/store.ts';

/** the numbers a user would see down the list, in order */
const shown = () => samples().map((s) => sampleNumber(s.id));

test('sample numbers are always 1…n with no gaps', () => {
  createRoot((dispose) => {
    try {
      setSamples([]);
      for (const hex of ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#00FFFF', '#FF00FF']) addSample(hex, 0.5, 0.5);
      assert.deepEqual(shown(), [1, 2, 3, 4, 5, 6]);

      // delete the first: what remains closes up to 1–5, it does not keep a hole at 1
      removeSample(samples()[0].id);
      assert.deepEqual(shown(), [1, 2, 3, 4, 5]);

      // and the next point taken is 6, not 7
      addSample('#123456', 0.4, 0.6);
      assert.deepEqual(shown(), [1, 2, 3, 4, 5, 6]);

      // a hole in the middle closes the same way
      removeSample(samples()[2].id);
      assert.deepEqual(shown(), [1, 2, 3, 4, 5]);
    } finally {
      dispose();
    }
  });
});

test('the internal id survives a renumber, so nothing keyed on it follows the label', () => {
  createRoot((dispose) => {
    try {
      setSamples([]);
      const first = addSample('#FF0000', 0.5, 0.5);
      const second = addSample('#00FF00', 0.5, 0.5);
      removeSample(first);
      assert.deepEqual(samples().map((s) => s.id), [second], 'the surviving dot keeps its id');
      assert.equal(sampleNumber(second), 1, 'while its number becomes 1');
      assert.equal(sampleNumber('missing'), 0, 'a dot that is not there is not numbered');
    } finally {
      dispose();
    }
  });
});

test('a hand-placed target never rewrites the colour a dot measured', () => {
  createRoot((dispose) => {
    try {
      setSamples([]);
      // an orange dot, dragged toward cyan in Custom mode
      const id = addSample('#D28C46', 0.5, 0.5);
      setCustomHue({ [id]: 200 });

      const d = dots().find((x) => x.id === id)!;
      assert.equal(d.hex, '#D28C46', 'the reading is untouched');
      assert.equal(Math.round(d.hue), 30, 'and it is still plotted at the hue it measured');
      assert.equal(d.custom, 200, 'the intention is kept beside it, not on top of it');

      clearCustomHue(id);
      const back = dots().find((x) => x.id === id)!;
      assert.equal(back.custom, undefined, 'taking the target back leaves the fact');
      assert.equal(Math.round(back.hue), 30);
    } finally {
      dispose();
    }
  });
});
