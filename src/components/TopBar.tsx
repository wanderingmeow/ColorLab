import { locale, pickLocale, t } from '../i18n/index.ts';
import { IconHelp } from './Icons.tsx';

export function TopBar(props: { onHelp: () => void }) {
  return (
    <header class="border-b border-line">
      <div class="mx-auto flex max-w-[1440px] items-center gap-6 px-6 py-3">
        <div class="flex items-baseline gap-2">
          <span class="display text-[15px] tracking-[0.22em] uppercase">{t('meta.name')}</span>
        </div>

        <div class="ml-auto flex items-center gap-3">
          {/*
            Language names are printed in their own language — the point is that a reader can
            recognise the one they want, not that the label is translated out from under them.
          */}
          <div class="seg seg-sm" role="group" aria-label={t('top.switchLang')}>
            <button aria-pressed={locale() === 'en'} onClick={() => pickLocale('en')}>EN</button>
            <button aria-pressed={locale() === 'zh'} onClick={() => pickLocale('zh')}>中文</button>
          </div>
          <button class="btn btn-quiet" onClick={props.onHelp} title={t('top.helpTitle')} aria-label={t('top.helpAria')}>
            <IconHelp size={17} />
          </button>
        </div>
      </div>
    </header>
  );
}
