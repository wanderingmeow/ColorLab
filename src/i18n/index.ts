/**
 * i18n — @solid-primitives/i18n with two static dictionaries.
 *
 * The browser chooses the language on a first visit (`navigator.languages`, in the browser's
 * own order, English as the fallback). Once someone presses EN / 中文 that choice is theirs
 * and is remembered — a refresh that silently hands the page back to the browser's opinion
 * is a control that does not work. The whole app reads text through `t()`; `src/i18n/en.ts`
 * is the source of truth for the key set (zh is checked against it by `satisfies`).
 */
import * as i18n from '@solid-primitives/i18n';
import { createEffect, createSignal } from 'solid-js';
import { hueName } from '../lib/color.ts';
import type { HarmonyType } from '../lib/harmonies.ts';
import { dict as en } from './en.ts';
import type { Dict } from './en.ts';
import { dict as zh } from './zh.ts';

export type Locale = 'en' | 'zh';
/** Locale-independent translator signature, used by the pure lib modules. */
export type Translate = (key: string, args?: Record<string, string | number | boolean>) => string;

const dicts: Record<Locale, Dict> = { en, zh };

// The unit tests import this module in bare node to check the copy and the placeholder sets,
// so locale detection cannot assume window exists. It is the only reason: this app is a
// static bundle with no server, no prerender and no hydration.
const hasBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

/**
 * Which dictionary to use, straight from the browser, in the browser's own order: walk
 * `navigator.languages` and the first tag this app can speak decides. So `['en-US','zh-CN']`
 * reads English — that reader put English first on purpose — while `['zh-CN','en-US']`
 * reads Chinese. Unrecognised families are skipped, and English is the fallback.
 *
 * Only Simplified is volunteered. A Traditional tag — `zh-Hant`, `zh-TW`, `zh-HK`, `zh-MO` —
 * is not a request for Simplified text, and there is no Traditional dictionary to answer it
 * with, so it is treated like any language this app cannot speak: skip it, fall to the
 * reader's next preference, and leave 中文 on the pill for them to press. Reading Simplified
 * to someone who asked for Traditional is guessing their script from their region and then
 * serving them the guess; pressing a button is their decision.
 *
 * `zh-Hans-TW` still reads Simplified — the script was stated, so nothing is being guessed.
 */
export function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en';
  // in the browser's own order: the first tag this app can speak decides
  const wanted = [...(navigator.languages ?? []), navigator.language].filter(Boolean);
  for (const tag of wanted) {
    const l = tag.trim().toLowerCase();
    if (/^en([-_]|$)/.test(l)) return 'en';
    if (!/^zh([-_]|$)/.test(l)) continue;
    if (l.includes('hans')) return 'zh';
    if (l.includes('hant') || /(^|[-_])(tw|hk|mo)([-_]|$)/.test(l)) continue;
    return 'zh';
  }
  return 'en';
}

/** the raw `?lang=` value — a debugging affordance (like ?ruler=1), not a user-facing control */
const urlLocale = (): string | null =>
  hasBrowser ? new URLSearchParams(window.location.search).get('lang') : null;

const KEY = 'colorlab.locale';
/** the last language the reader picked, or null on a first visit */
const savedLocale = (): string | null => {
  if (!hasBrowser) return null;
  try { return window.localStorage.getItem(KEY); } catch { return null; }   // private mode: no memory, no crash
};

/**
 * Priority, isolated so it can be tested without a window: a forced debug value beats a
 * remembered choice, which beats what the browser thinks.
 */
export function resolveLocale(forced: string | null, saved: string | null, browser: Locale): Locale {
  const f = forced === 'en' || forced === 'zh' ? forced : null;
  const s = saved === 'en' || saved === 'zh' ? saved : null;
  return f ?? s ?? browser;
}

export const [locale, setLocale] = createSignal<Locale>(
  resolveLocale(urlLocale(), savedLocale(), detectLocale()),
  { equals: (a, b) => a === b },
);

/** Choose a language and remember it. This is the only language write in the app. */
export function pickLocale(next: Locale): void {
  setLocale(next);
  if (!hasBrowser) return;
  try { window.localStorage.setItem(KEY, next); } catch { /* nowhere to remember it; this page still switches */ }
}


// A module-level memo would be unowned (created outside any root) and would keep serving
// the first dictionary after setLocale(); flatten lazily in a plain function instead.
const cache = new Map<Locale, ReturnType<typeof i18n.flatten<Dict>>>();
const flat = () => {
  const l = locale();
  let d = cache.get(l);
  if (!d) { d = i18n.flatten(dicts[l]); cache.set(l, d); }
  return d;
};
const translate = i18n.translator(flat, i18n.resolveTemplate);

/**
 * `t('sample.countMinimum', { min: 5 })`.
 * Keys built at runtime (`'hue.' + name`) are not in the generated union, so this wrapper
 * takes any string and warns instead of crashing when one is missing.
 */
export const t: Translate = (key, args) => {
  const out = (translate as unknown as (k: string, a?: object) => string | undefined)(key, args);
  if (out === undefined) {
    if (import.meta.env?.DEV) console.warn(`[i18n] missing key "${key}" in "${locale()}"`);
    return key;
  }
  return out;
};

/* ------------------------------------------------------- domain helpers */

/** hue degrees -> localised colour word ("sky blue" / 天蓝) */
export const hueLabel = (hue: number): string => t(`hue.${hueName(hue)}`);
/** degrees or a canonical bucket name from `HUE_NAMES` */
export const hueBucket = (name: string): string => t(`hue.${name}`);
export const harmonyLabel = (type: HarmonyType): string => t(`harmonyName.${type}`);

/* ------------------------------------------------------- document glue */

if (hasBrowser) {
  createEffect(() => {
    const l = locale();
    document.documentElement.lang = dicts[l].meta.htmlLang;
    document.title = dicts[l].meta.title;
  });
}
