import { Show } from 'solid-js';
import { t } from '../i18n/index.ts';
import { photo, samples, setStep, setTab } from '../lib/store.ts';
import { HueMap } from './HueMap.tsx';
import { PhotoStage } from './PhotoStage.tsx';
import { SamplePanel } from './SamplePanel.tsx';
import { Upload } from './Upload.tsx';

/**
 * Step 1: get the colours out of the photograph.
 *
 * The two notices above the canvas are the only places the app comments on the picture
 * itself — one saying the points were re-read from a new render, one saying the frame looks
 * like somebody already graded it.
 */
export function SampleView(props: { reanalysing: () => boolean; edited: () => string | null }) {
  return (
    <section>
      <div class="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(200px,220px)]">
      <div>
      <span class="eyebrow">{t('app.step1Eyebrow')}</span>
      <h2 class="display mt-1 max-w-[22ch] text-[34px] leading-[1.12] sm:text-[38px]">
        {t('app.h1a')}<span class="accent">{t('app.h1Accent')}</span>{t('app.h1b')}
      </h2>
      <p class="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-ink-2">{t('app.step1Lead')}</p>

      <Show when={props.reanalysing()}>
        <p class="mt-3 max-w-[70ch] rounded border-l-[3px] border-clay bg-[#f6ece4] px-3 py-2 text-[12.5px] text-[#6d4a33]">
          {t('app.reanalyse', { n: samples().length })}
        </p>
      </Show>

      <Show when={props.edited()}>
        {(cast) => (
          <p class="mt-3 max-w-[70ch] rounded border-l-[3px] border-[#8a6a33] bg-[#f6ecdd] px-3 py-2 text-[12.5px] text-[#6d5220]">
            {t('app.editedWarn', { cast: cast() === 'cool' ? t('app.castCool') : t('app.castWarm') })}
          </p>
        )}
      </Show>

      </div>
      {/*
        The cloud sits at the top of the page, beside the heading: it is the first thing that
        answers "what colours does this photograph hold", and the space right of the heading
        was empty. Compact there — the sentence it would rather say is a tooltip, because a
        card that pushes the photograph below the fold has taken more than it gave.
      */}
      <Show when={photo()}><HueMap compact /></Show>
      </div>

      <div class="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(380px,440px)]">
        <div class="card p-4 grid place-items-center">
          <Show when={photo()} fallback={<Upload />}>
            <PhotoStage />
          </Show>
        </div>
        <Show when={photo() || samples().length > 0}>
          <SamplePanel onAnalyze={() => { setStep('harmony'); setTab('guide'); }} />
        </Show>
      </div>
    </section>
  );
}
