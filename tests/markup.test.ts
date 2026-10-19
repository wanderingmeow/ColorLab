/**
 * Markup invariants a browser would show and a test would not.
 *
 * `happy-dom` has no layout: nothing in the DOM tests can notice a copy icon falling onto a
 * second line under its hex, because nothing here measures a line. These read the source
 * instead — cheap, and they fail at the line that caused it rather than at a screenshot
 * somebody has to compare by eye.
 */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const components = () => {
  const dir = new URL('../src/components', import.meta.url).pathname;
  return readdirSync(dir).filter((f) => f.endsWith('.tsx')).map((f) => join(dir, f));
};

const BUTTON = /<button\b[\s\S]*?<\/button>/g;

test('a hex and its copy icon are one thing and break as one thing', () => {
  const checked: string[] = [];
  const broken: string[] = [];
  for (const file of components()) {
    for (const [tag] of readFileSync(file, 'utf8').matchAll(BUTTON)) {
      if (!tag.includes('IconCopy')) continue;
      checked.push(tag);
      // before the icon appears, the button has to have said `flex`: a plain inline button
      // puts its icon on the next line the moment the column gets narrow, and a copy affordance
      // alone on a line belongs to nobody
      if (!tag.slice(0, tag.indexOf('IconCopy')).includes('flex')) {
        broken.push(`${file}: ${tag.slice(0, 90).replace(/\s+/g, ' ')}`);
      }
    }
  }
  assert.ok(checked.length >= 3, `only ${checked.length} copy buttons found — the walk is broken`);
  assert.deepEqual(broken, [], 'every control that copies a colour must keep the icon beside it');
});
