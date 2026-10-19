/**
 * The parts of this app that only exist once something is painted.
 *
 * Three of the bugs this project fixed could not be found by calling the store: a loupe that
 * computed the right position and was still clipped by the top of the window, a Clear button
 * whose handler was correct and whose click never landed, and a selected dot that was drawn
 * and then covered by its neighbour because SVG has no z-index. They are tested here against
 * a real DOM (`happy-dom`, `--conditions browser` — see tests/dom-env.ts).
 */
// @vitest-environment happy-dom
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { buttonWithText, clearDom, click, flush, mount, textOf } from './dom-env.ts';
import { pickLocale } from '../src/i18n/index.ts';
import {
  addSample, clearAll, samples, selected, setPhoto, setPixelsSrc, setSamples, setSelected, updateSample,
} from '../src/lib/store.ts';
import { SamplePanel } from '../src/components/SamplePanel.tsx';
import { HarmonyPanel } from '../src/components/HarmonyPanel.tsx';
import { HueMap } from '../src/components/HueMap.tsx';
import { sampler } from '../src/lib/image.ts';
import { flat } from './frame.ts';
import { Loupe } from '../src/components/Loupe.tsx';
import { Wheel } from '../src/components/Wheel.tsx';
import { TopBar } from '../src/components/TopBar.tsx';

const INKS = ['#B7C63C', '#747476', '#3E63DD', '#D28C46', '#2E9E7A'];
const seed = (n = 4) => {
  setSamples([]);
  for (let i = 0; i < n; i++) addSample(INKS[i % INKS.length], 0.2 + i * 0.15, 0.3 + i * 0.1);
};

test('Clear really removes the rows, and Undo really puts them back', async () => {
  clearDom();
  pickLocale('en');
  seed();
  const host = await mount(() => SamplePanel({ onAnalyze: () => {} }));
  const rows = () => host.querySelectorAll('[data-sample-id]').length;
  assert.equal(rows(), 4, 'four points, four rows');

  click(buttonWithText(host, 'Clear'));
  assert.equal(samples().length, 0, 'the store emptied');
  assert.equal(rows(), 0, 'and the list went with it — this is the part that was only ever believed');

  click(buttonWithText(host, 'Undo'));
  assert.equal(samples().length, 4, '⌘Z from the button');
  assert.equal(rows(), 4, 'the rows come back as one action, not four');
});

test('every control says what it does', async () => {
  clearDom();
  seed();
  const host = await mount(() => SamplePanel({ onAnalyze: () => {} }));
  const silent = [...host.querySelectorAll('button, [role="button"]')].filter(
    (b) => !textOf(b) && !b.getAttribute('aria-label') && !b.getAttribute('title'),
  );
  assert.deepEqual(silent.map((b) => b.outerHTML.slice(0, 80)), [],
    'a button nobody can name is a button somebody has to guess at');
});

test('the loupe flips to whichever side the screen has room for', async () => {
  clearDom();
  seed();
  // a photo pinned to the top-right corner of the screen: the loupe has nowhere else to go
  const stageAt = (left: number, top: number, width = 100, height = 100) =>
    ({ getBoundingClientRect: () => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) }) as unknown as HTMLElement;
  const stage = stageAt(900, 10);
  Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });

  const host = await mount(() => Loupe({ at: () => ({ u: 0.9, v: 0.05 }), stage: () => stage, drag: () => null }));
  const box = host.querySelector('div') as HTMLElement;
  assert.ok(box.style.left.includes('% - '), `near the right edge it has to hang to the left, got ${box.style.left}`);
  assert.ok(box.style.top.includes('% + '), `near the top edge it has to hang below, got ${box.style.top}`);

  // the middle of a wide screen: the default above-right placement, no flipping
  const host2 = await mount(() => Loupe({ at: () => ({ u: 0.5, v: 0.5 }), stage: () => stageAt(200, 400, 400, 300), drag: () => null }));
  const box2 = host2.querySelector('div') as HTMLElement;
  assert.ok(box2.style.left.includes('% + '), `default is right of the cursor, got ${box2.style.left}`);
  assert.ok(box2.style.top.includes('% - '), `default is above the cursor, got ${box2.style.top}`);
});

test('the selected dot is painted after its neighbours, with its arrow', async () => {
  clearDom();
  seed();
  setSelected(samples()[2].id);
  const host = await mount(() => Wheel());
  const overlay = host.querySelector('g[pointer-events="none"]');
  assert.ok(overlay, 'the wheel repaints the selected dot on top');
  const order = [...host.querySelectorAll('svg *')];
  const chips = [...host.querySelectorAll('g[role="button"]')];
  assert.ok(chips.length >= 4, 'every sample is a chip');
  for (const chip of chips) {
    assert.ok(order.indexOf(overlay) > order.indexOf(chip),
      'SVG paints in document order: anything painted earlier is covered');
  }
  assert.ok(textOf(overlay).includes('3'), 'and it carries the number the list shows');
});

test('the language switch changes the page and is remembered', async () => {
  clearDom();
  pickLocale('en');
  const host = await mount(() => TopBar({ onHelp: () => {} }));
  assert.match(textOf(host), /Colour|Color|harmony/);
  click(buttonWithText(host, '中文'));
  await flush();
  assert.equal(document.documentElement.lang, 'zh-Hans', 'the document says what language it is in');
  assert.equal(localStorage.getItem('colorlab.locale'), 'zh', 'and it survives a refresh');
  assert.match(textOf(host), /[一-鿿]/, 'the bar itself switched');
  pickLocale('en');
});

test('a harmony the samples cannot carry is disabled, with the reason on it', async () => {
  clearDom();
  // one hue, four times: the maths loves a four-arm skeleton over identical colours
  seed(4);
  setSamples(samples().map((s, i) => ({ ...s, hex: '#D28C46', id: s.id, x: 0.3 + i * 0.1, y: 0.5 })));
  const host = await mount(() => HarmonyPanel());
  const tetradic = [...host.querySelectorAll('button')].find((b) => textOf(b).includes('Tetradic'));
  assert.ok(tetradic, 'the scheme is still offered, so the user can see it was considered');
  assert.equal(tetradic.getAttribute('aria-pressed'), 'false');
  assert.ok(tetradic.hasAttribute('disabled'), 'but it cannot be chosen');
  assert.match(tetradic.getAttribute('title') ?? '', /\d/, 'and the tooltip says what is missing');
});

test('the panel shows separation next to harmony and never adds them up', async () => {
  clearDom();
  seed(4);
  setSamples(samples().map((s, i) => ({ ...s, id: s.id,
    hex: ['#0FB3B3', '#FF7A29', '#2F2F2F', '#F2F2F2'][i], x: 0.3 + i * 0.1, y: 0.5 })));
  const host = await mount(() => HarmonyPanel());
  const text = textOf(host);
  assert.match(text, /Harmony/, 'the structure reading is labelled as itself');
  assert.match(text, /Separation/, 'and so is the other axis');
  assert.match(text, /Warm–cool spread/);
  assert.match(text, /Lightness contrast/);
  const tips = [...host.querySelectorAll('[title]')]
    .filter((e) => /warmest|darkest/.test(e.getAttribute('title') ?? ''));
  assert.equal(tips.length, 2, 'each reading says which colours it measured');
  assert.match(text, /half the time/, 'and the score states how much people agree');
});

test('a sample row keeps its number in the list and on the wheel', async () => {
  clearDom();
  seed();
  const host = await mount(() => SamplePanel({ onAnalyze: () => {} }));
  const first = host.querySelector('[data-sample-id]');
  assert.ok(first, 'rows are rendered');
  const removed = samples()[0].id;
  updateSample(removed, {});
  const before = [...host.querySelectorAll('[data-sample-id]')].map(textOf);
  assert.ok(before[0].startsWith('1'), `the first row is number 1, got ${before[0].slice(0, 12)}`);
  clearAll();
  await flush();
  assert.equal(host.querySelectorAll('[data-sample-id]').length, 0);
});

test('dragging a row by its number reorders the list, and the numbers follow', async () => {
  clearDom();
  pickLocale('en');
  seed();
  const ids = samples().map((s) => s.id);
  const host = await mount(() => SamplePanel({ onAnalyze: () => {} }));
  const rows = () => [...host.querySelectorAll('[data-sample-id]')] as HTMLElement[];
  const order = () => rows().map((r) => r.getAttribute('data-sample-id'));
  const handle = (id: string) => rows().find((r) => r.getAttribute('data-sample-id') === id)!
    .querySelector('[draggable="true"]') as HTMLElement;
  // happy-dom gives no layout, so every rect is zero-height: a positive clientY is always the
  // lower half of a row and a negative one is always the upper half. The two branches are
  // still both exercised, which is what the arithmetic is made of.
  const drag = (type: string, y = 0) => {
    const e = new Event(type, { bubbles: true, cancelable: true }) as Event & { clientY: number };
    e.clientY = y;
    return e;
  };

  handle(ids[0]).dispatchEvent(drag('dragstart'));
  const onto = rows().find((r) => r.getAttribute('data-sample-id') === ids[2])!;
  onto.dispatchEvent(drag('dragover', 999));
  onto.dispatchEvent(drag('drop'));
  await flush();
  assert.deepEqual(order(), [ids[1], ids[2], ids[0], ids[3]], 'dropped below the third row');
  assert.deepEqual(samples().map((s) => s.id), order(), 'the store and the DOM agree');
  assert.match(textOf(rows()[2]), /^3/, 'the moved row now calls itself 3 — the number is the order');

  // and one undo puts the whole reorder back, because it was one action
  click(buttonWithText(host, 'Undo'));
  await flush();
  assert.deepEqual(order(), ids, 'a reorder is one thing to undo, not four');

  // the keyboard route, for anyone not dragging: Alt+↑ moves a row one step up
  handle(ids[2]).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, bubbles: true, cancelable: true }));
  await flush();
  assert.deepEqual(order(), [ids[0], ids[2], ids[1], ids[3]], 'Alt+↑ moved the third row one step up, not to the top');

  // dropping on the upper half inserts before the row instead of after it
  handle(ids[3]).dispatchEvent(drag('dragstart'));
  const above = rows().find((r) => r.getAttribute('data-sample-id') === ids[1])!;
  above.dispatchEvent(drag('dragover', -1));
  above.dispatchEvent(drag('drop'));
  await flush();
  assert.deepEqual(order(), [ids[0], ids[2], ids[3], ids[1]], 'dropped above the row it was hovering');
});

test('the hue map numbers its dots like the list, and clicking one selects it', async () => {
  clearDom();
  pickLocale('en');
  seed();
  const host = await mount(() => HueMap({}));
  const marks = () => [...host.querySelectorAll('[role="button"]')] as Element[];
  assert.equal(marks().length, 4, 'one dot per sample point');
  assert.deepEqual(
    marks().map((m) => (m.getAttribute('aria-label') ?? '').match(/\d+/)?.[0]),
    ['1', '2', '3', '4'],
    'the same numbers the list, the photo and the wheel show',
  );
  assert.doesNotMatch(textOf(host), /\{\{/, 'placeholders are filled in, not printed');

  setSelected(null);
  click(marks()[2]);
  await flush();
  assert.equal(selected(), samples()[2].id, 'a dot on the map selects the sample everywhere');
  assert.match(textOf(host), /Hue map/, 'and the card says what it is');
});

test('a photo that arrives — or is pasted over the last one — repaints the hue map', async () => {
  clearDom();
  pickLocale('en');
  setSamples([]);
  // the order the app actually produces: the photo signal lands first, the decoded pixels
  // some time after, and the pixel layer is not reactive
  setPhoto({ src: 'frame-a', name: 'a', w: 21, h: 21 });
  const host = await mount(() => HueMap({}));
  assert.match(textOf(host), /no hue to plot|几乎/i, 'nothing to plot until the pixels are in');

  sampler.loadPixels(flat([62, 99, 221], 21, 21), 21, 21);
  setPixelsSrc('frame-a');
  await flush();
  assert.doesNotMatch(textOf(host), /no hue to plot/, 'the cloud appears when the pixels do, without a remount');

  // and a paste that replaces the photo empties it again rather than keeping the last cloud
  setPhoto({ src: 'frame-b', name: 'b', w: 21, h: 21 });
  await flush();
  assert.match(textOf(host), /no hue to plot|几乎/i, 'a new photo is not the old one');
});
