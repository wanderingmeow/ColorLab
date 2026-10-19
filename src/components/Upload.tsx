import { Show, createSignal } from 'solid-js';
import { t } from '../i18n/index.ts';
import { loadFile } from '../lib/store.ts';
import { IconPlus } from './Icons.tsx';

export function Upload(props: { compact?: boolean }) {
  const [over, setOver] = createSignal(false);
  const [error, setError] = createSignal('');
  const [busy, setBusy] = createSignal(false);

  async function take(file: File | undefined | null) {
    if (!file) return;
    setError(''); setBusy(true);
    try {
      await loadFile(file);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('upload.errorFallback'));
    } finally { setBusy(false); }
  }

  return (
    <div
      class={`card grid place-items-center text-center transition-colors ${props.compact ? 'p-8' : 'p-16'}`}
      style={{ 'min-height': props.compact ? '220px' : '320px', 'border-style': 'dashed', 'border-width': '1px' }}
      classList={{ '!border-clay !bg-[#faf1ea]': over() }}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); void take(e.dataTransfer?.files?.[0]); }}
      role="button"
      tabIndex={0}
      aria-label={t('upload.aria')}
      onClick={(el) => {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = 'image/*';
        input.onchange = () => void take(input.files?.[0]);
        input.click();
        void el;
      }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') (e.currentTarget as HTMLElement).click(); }}
    >
      <div class="text-clay"><IconPlus size={34} /></div>
      <p class="mt-3 text-[15px]">{busy() ? t('upload.busy') : t('upload.dropHere')}</p>
      <p class="mt-4 text-[12px] text-muted">
        {t('upload.pasteTipA')}
        <kbd class="font-mono rounded border border-line-2 px-1">{t('upload.pasteKey')}</kbd>
        {t('upload.pasteTipB')}
      </p>
      <Show when={error()}>
        <p class="mt-3 text-[12.5px] text-clay" role="alert">{error()}</p>
      </Show>
    </div>
  );
}
