import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { dict as en } from '../src/i18n/en.ts';
import { dict as zh } from '../src/i18n/zh.ts';

/**
 * Every literal translation key in src/ must exist in every locale.
 *
 * `t()` takes a plain string, so a typo — or a dictionary entry deleted while its call site
 * survives — compiles clean and falls back at runtime. This walks the source instead, which
 * also catches the mess a half-reverted file leaves behind.
 *
 * Dynamic keys (`t(\`harmony.${x}\`)`, `t(l.key)`) cannot be checked this way and are skipped
 * on purpose; their placeholders are covered by the locale parity test.
 */
const KEY = /\bt\(\s*'([a-zA-Z][\w.]*)'/g;

/** Docs and comments quote keys too (`t('hue.' + hueName(h))`); they are not call sites. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\/|(?:^|(?<=\s))\/\/[^\n]*/g, '');
}

function sources(dir = new URL('../src', import.meta.url).pathname): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.(tsx?|jsx?)$/.test(name) && !p.includes('/i18n/') ? [p] : [];
  });
}

function has(d: object, path: string): boolean {
  return path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], d) !== undefined;
}

test('every t("…") key in the source resolves in both locales', () => {
  const files = sources();
  assert.ok(files.length > 8, `found only ${files.length} source files — the walk is broken`);

  const missing: string[] = [];
  let checked = 0;
  for (const file of files) {
    const text = stripComments(readFileSync(file, 'utf8'));
    for (const [, key] of text.matchAll(KEY)) {
      checked++;
      if (!has(en, key)) missing.push(`${relative('.', file)} → ${key} (en)`);
      if (!has(zh, key)) missing.push(`${relative('.', file)} → ${key} (zh)`);
    }
  }
  assert.ok(checked > 120, `only ${checked} keys found — the regex is not matching`);
  assert.deepEqual(missing, []);
});

test('the number on screen is the position, never the internal id', () => {
  // `id.replace('c','')` was how every label used to be built; the moment a dot was deleted
  // the sampling panel (which numbers by position) and the harmony panel (which printed the
  // id) disagreed about what the same dot was called.
  const offenders = sources()
    .filter((f) => /replace\(\s*['"]c['"]\s*\/|replace\(\s*\/\^c\//.test(readFileSync(f, 'utf8')))
    .map((f) => relative('.', f));
  assert.deepEqual(offenders, [], 'print sampleNumber(id): the id survives deletions, the number does not');
});
