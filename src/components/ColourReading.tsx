import { Show } from 'solid-js';
import { hueLabel, t } from '../i18n/index.ts';
import { chromaRatio } from '../lib/color.ts';
import type { HSL } from '../lib/color.ts';
import { NEUTRAL_FLOOR } from '../lib/harmonies.ts';
import { IconCopy, IconEyeOff } from './Icons.tsx';

/**
 * One colour, read out: the hex (which copies), the three HSL numbers, and the word they
 * spell together.
 *
 * This markup used to be written out twice — once in the sample list, once in the values
 * panel — which is how the colour name ended up wrapping onto its own line in one of them
 * and how the two panels could disagree about what a sample's numbers looked like. There is
 * now one place that decides, and it always says which number is which: `52° · 59% · 26%`
 * asked the reader to remember the order, `H 52° · S 59% · L 26%` does not.
 */
export function ColourReading(props: {
  hex: string;
  hsl: HSL;
  copied: () => boolean;
  onCopy: () => void;
  /** the values panel marks excluded samples here; the list does it by dimming the row */
  ignored?: boolean;
}) {
  const neutral = () => chromaRatio(props.hex) < NEUTRAL_FLOOR;
  return (
    <>
      <button
        class="mt-[2px] flex items-center gap-1.5 font-mono text-[12px] text-ink-2 hover:text-clay"
        onClick={(e) => { e.stopPropagation(); props.onCopy(); }}
        title={t('sample.copyHex')}
      >
        {props.hex}
        <IconCopy size={12} class={props.copied() ? 'text-clay' : 'opacity-45'} />
        <Show when={props.copied()}><span class="text-[10px] text-clay">{t('sample.copied')}</span></Show>
      </button>
      {/* one line: the numbers and the word they spell are the same reading */}
      <div class="mono-meta mt-[2px] flex flex-wrap items-center gap-1.5">
        <span>
          H {Math.round(props.hsl.h)}° · S {Math.round(props.hsl.s)}% · L {Math.round(props.hsl.l)}%
        </span>
        <span class="text-[12px] text-muted">· {hueLabel(props.hsl.h)}</span>
        <Show when={neutral()}>
          <span
            class="rounded bg-[#efe2d3] px-1 text-[9.5px] uppercase tracking-wide text-[#8a6a33]"
            title={t('sample.neutralTitle')}
          >
            {t('sample.neutral')}
          </span>
        </Show>
        <Show when={props.ignored}><IconEyeOff size={11} class="opacity-50" /></Show>
      </div>
    </>
  );
}
