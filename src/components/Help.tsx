import { For } from 'solid-js';
import { t } from '../i18n/index.ts';

const STEPS = [
  { n: '1', tKey: 'help.s1t', dKey: 'help.s1d' },
  { n: '2', tKey: 'help.s2t', dKey: 'help.s2d' },
  { n: '3', tKey: 'help.s3t', dKey: 'help.s3d' },
  { n: '4', tKey: 'help.s4t', dKey: 'help.s4d' },
] as const;

const WHEEL = [
  { k: 'help.wNatural', d: 'help.wNaturalD' },
  { k: 'help.wPure', d: 'help.wPureD' },
  { k: 'help.wGuide', d: 'help.wGuideD' },
] as const;

const KNOW = ['help.know1', 'help.know2', 'help.know3', 'help.know4'] as const;

const KEYS = [
  ['⌘V', 'help.scPaste'], ['⌘Z', 'help.scUndo'], ['↑ ↓ ← →', 'help.scNudge'],
  ['⌫', 'help.scDelete'], ['Esc', 'help.scEsc'],
] as const;

export function Help() {
  return (
    <div class="px-5 py-5 text-[13.5px] leading-relaxed text-ink-2">
      <p class="note text-[15px] text-gold">{t('help.eyebrow')}</p>
      <div class="mt-4 flex flex-col gap-4">
        <For each={STEPS}>{(s) => (
          <div class="flex gap-3">
            <span class="display mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line-2 text-[12px]">{s.n}</span>
            <div>
              <h3 class="display text-[16px] text-ink">{t(s.tKey)}</h3>
              <p class="mt-0.5 text-[13px]">{t(s.dKey)}</p>
            </div>
          </div>
        )}</For>
      </div>

      <hr class="my-5 border-line" />

      <h3 class="display text-[16px]">{t('help.wheelTitle')}</h3>
      <ul class="mt-2 list-disc pl-5 text-[13px]">
        <For each={WHEEL}>{(w) => <li><b>{t(w.k)}</b> {t(w.d)}</li>}</For>
      </ul>

      <h3 class="display mt-5 text-[16px]">{t('help.knowing')}</h3>
      <ul class="mt-2 list-disc pl-5 text-[13px]">
        <For each={KNOW}>{(k) => <li>{t(k)}</li>}</For>
      </ul>

      <h3 class="display mt-5 text-[16px]">{t('help.shortcuts')}</h3>
      <dl class="mono-meta mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <For each={KEYS}>{(k) => <><dt>{k[0]}</dt><dd>{t(k[1])}</dd></>}</For>
      </dl>

      <p class="mt-5 text-[12px] text-muted">{t('help.privacy')}</p>
    </div>
  );
}
