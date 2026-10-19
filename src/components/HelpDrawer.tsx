import { Show } from 'solid-js';
import { t } from '../i18n/index.ts';
import { Help } from './Help.tsx';
import { IconClose } from './Icons.tsx';

/** The side sheet. Escape closes it as well; the shell owns that key. */
export function HelpDrawer(props: { open: () => boolean; onClose: () => void }) {
  return (
    <Show when={props.open()}>
      <div class="fixed inset-0 z-40 bg-[#241d17]/35" onClick={props.onClose} aria-hidden="true" />
      <div class="fixed right-0 top-0 z-50 h-full w-full max-w-[440px] overflow-y-auto bg-paper shadow-2xl">
        <div class="sticky top-0 flex items-center justify-between border-b border-line bg-paper px-5 py-3">
          <span class="display text-[19px]">{t('app.helpTitle')}</span>
          <button class="btn btn-quiet" onClick={props.onClose} aria-label={t('app.closeHelp')}>
            <IconClose size={16} />
          </button>
        </div>
        <Help />
      </div>
    </Show>
  );
}
