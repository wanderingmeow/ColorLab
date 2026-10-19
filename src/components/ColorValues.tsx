import { For } from 'solid-js';
import { t } from '../i18n/index.ts';
import { dots, sampleNumber, selected, setSelected } from '../lib/store.ts';
import { ColourReading } from './ColourReading.tsx';
import { useCopy } from '../lib/ui.ts';

export function ColorValues() {
  const { copied, copy } = useCopy();
  return (
    <aside class="card p-4">
      <h3 class="display text-[17px]">{t('wheel.valuesTitle')}</h3>
      <p class="text-[12.5px] text-muted mt-0.5 mb-3">{t('wheel.valuesHint')}</p>
      <div class="flex flex-col gap-2 overflow-y-auto pr-1" style={{ 'max-height': '58vh' }}>
        <For each={dots()}>
          {(d) => {
            return (
              <div class="row" data-selected={selected() === d.id} onClick={() => setSelected(d.id)}
                classList={{ 'opacity-50': d.ignored }}>
                <span class="mono-meta pt-[9px]">{sampleNumber(d.id)}</span>
                <span class="swatch mt-[2px]" style={{ background: d.hex }} aria-hidden="true" />
                <div class="min-w-0">
                  <div class="truncate text-[13px] font-semibold">{d.label || <span class="italic font-normal text-muted">{t('sample.unnamed')}</span>}</div>
                  <ColourReading
                    hex={d.hex} hsl={d.hsl} ignored={d.ignored}
                    copied={() => copied() === d.id} onCopy={() => copy(d.hex, d.id)}
                  />
                </div>
                <span />
              </div>
            );
          }}
        </For>
      </div>
    </aside>
  );
}
