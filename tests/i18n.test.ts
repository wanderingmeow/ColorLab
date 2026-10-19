import { test } from 'vitest';
import assert from 'node:assert/strict';
import * as i18n from '@solid-primitives/i18n';
import { dict as en } from '../src/i18n/en.ts';
import { dict as zh } from '../src/i18n/zh.ts';
import { detectLocale, hueLabel, resolveLocale, setLocale, t } from '../src/i18n/index.ts';

const strings = (d: typeof en) => i18n.flatten(d) as unknown as Record<string, unknown>;
const leaves = (d: typeof en) => Object.entries(strings(d)).filter(([, v]) => typeof v === 'string').map(([k]) => k).sort();

test('zh covers exactly the keys en declares, with no empty strings', () => {
  const a = leaves(en), b = leaves(zh);
  assert.deepEqual(b, a);
  const zhStrings = strings(zh);
  for (const k of a) assert.ok(String(zhStrings[k] ?? '').trim().length > 0, `empty value for ${k}`);
  assert.ok(a.length > 150, `suspiciously small dictionary (${a.length})`);
});

test('templates use the same placeholders in both languages', () => {
  const fe = strings(en) as Record<string, string>;
  const fz = strings(zh) as Record<string, string>;
  const tokens = (v: string) => (v.match(/{{\s*\w+\s*}}/g) ?? []).sort().join(',');
  for (const k of Object.keys(fe)) {
    if (typeof fz[k] !== 'string') continue;
    assert.equal(tokens(fz[k]), tokens(fe[k]), `placeholder mismatch in ${k}`);
  }
});

test('switching the locale switches every surface string', () => {
  setLocale('en');
  assert.equal(t('harmony.detected'), 'Detected harmony');
  assert.equal(hueLabel(207), 'sky blue');
  assert.equal(t('harmonyName.split-complementary'), 'Split-Complementary');
  setLocale('zh');
  assert.equal(t('harmony.detected'), '检测到的和谐');
  assert.equal(hueLabel(207), '天蓝');
  assert.equal(t('harmonyName.split-complementary'), '分裂互补');
  assert.equal(t('adj.bigShift', { hue: hueLabel(84) }), '往 黄绿 大幅挪动');
  setLocale('en');
});

test('no template placeholder survives a translate call', () => {
  for (const loc of ['en', 'zh'] as const) {
    setLocale(loc);
    const flatDict = strings(loc === 'en' ? en : zh) as Record<string, string>;
    for (const [k, v] of Object.entries(flatDict)) {
      if (typeof v !== 'string' || !/{{\s*\w+\s*}}/.test(v)) continue;
      const arg = Object.fromEntries([...v.matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => [m[1], 'X']));
      assert.doesNotMatch(t(k, arg), /{{/, `${loc}.${k} still has a placeholder`);
    }
  }
});

test('a remembered choice outranks the browser, ?lang outranks both', () => {
  assert.equal(resolveLocale(null, null, 'zh'), 'zh', 'first visit: the browser decides');
  assert.equal(resolveLocale(null, 'en', 'zh'), 'en', 'a refresh must keep the language someone picked');
  assert.equal(resolveLocale('zh', 'en', 'en'), 'zh', '?lang is the debugging override');
  assert.equal(resolveLocale('fr', 'de', 'zh'), 'zh', 'unrecognised values fall through');
});

test('the browser picks the language, in its own order', () => {
  const real = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const detect = (tags: string[]) => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { languages: tags, language: tags[0] }, configurable: true, writable: true,
    });
    return detectLocale();
  };
  try {
    assert.equal(detect(['zh-Hans-CN', 'en-US']), 'zh');
    assert.equal(detect(['zh-CN']), 'zh');
    assert.equal(detect(['zh']), 'zh');
    assert.equal(detect(['zh_CN']), 'zh', 'underscore form some engines emit');
    assert.equal(detect(['zh-Hans-TW', 'en-US']), 'zh', 'the script was stated, so nothing is guessed');
    // Traditional is not a request for Simplified text, and there is no Traditional
    // dictionary to answer it with: skip it like any language the app cannot speak
    assert.equal(detect(['fr', 'zh-TW']), 'en', 'a Traditional tag is not volunteered Simplified');
    assert.equal(detect(['zh-Hant', 'zh-HK']), 'en');
    assert.equal(detect(['zh-Hant-TW', 'zh-Hans-CN', 'en']), 'zh', 'the next preference that asks for Simplified wins');
    assert.equal(detect(['zh-HK']), 'en', 'a region subtag alone does not ask for Simplified');
    assert.equal(detect(['en-US']), 'en');
    assert.equal(detect(['en-GB', 'zh-HK']), 'en', 'an explicit English first choice outranks a later zh');
    assert.equal(detect(['ja', 'ko', 'fr']), 'en', 'unrecognised families fall back');
    assert.equal(detect(['zxx', 'zw']), 'en', 'a tag that merely starts with "zh" is not Chinese');
    assert.equal(detect([]), 'en');
  } finally {
    if (real) Object.defineProperty(globalThis, 'navigator', real);
    else delete (globalThis as { navigator?: unknown }).navigator;
  }
});
