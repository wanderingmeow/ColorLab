import { For, Show } from 'solid-js';
import { t } from '../i18n/index.ts';
import { photo, setStep, tab, setTab } from '../lib/store.ts';
import { ColorValues } from './ColorValues.tsx';
import { HarmonyPanel } from './HarmonyPanel.tsx';
import { HueMap } from './HueMap.tsx';
import { IconBack } from './Icons.tsx';
import { PhotoStage } from './PhotoStage.tsx';
import { Wheel } from './Wheel.tsx';

const TABS = [
  { id: 'natural', labelKey: 'wheel.tabNatural' },
  { id: 'pure', labelKey: 'wheel.tabPure' },
  { id: 'guide', labelKey: 'wheel.tabGuide' },
] as const;

/** Step 2: read the harmony, and decide what to do about it. */
export function HarmonyView() {
  return (
    <section>
      <span class="eyebrow block">{t('app.step2Eyebrow')}</span>
      <h2 class="display mt-1 max-w-[24ch] text-[34px] leading-[1.12] sm:text-[38px]">
        {t('app.h2a')}<span class="accent">{t('app.h2Accent')}</span>{t('app.h2b')}
      </h2>
      <p class="mt-2 max-w-[64ch] text-[14px] leading-relaxed text-ink-2">{t('app.step2Lead')}</p>

      <div class="mt-6 grid items-start gap-6 xl:grid-cols-[220px_minmax(0,1fr)_minmax(380px,440px)] lg:grid-cols-[180px_minmax(0,1fr)]">
        {/*
          The photo is the way back to sampling — it is the thing you look at when the
          harmony stops making sense, so the thumbnail carries the control rather than a
          separate button above the heading. It is a div[role=button] because the thumbnail
          renders its own sample-point buttons, and buttons cannot nest.
        */}
        <div class="min-w-0">
        <div
          role="button"
          tabindex={0}
          class="group cursor-pointer"
          title={t('app.backToSampling')}
          onClick={() => setStep('sample')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setStep('sample'); } }}
        >
          <span class="eyebrow flex items-center gap-1.5 transition-colors group-hover:text-clay group-focus-visible:text-clay">
            <IconBack size={12} /> {t('app.yourPhoto')}
          </span>
          <div class="card mt-2 grid place-items-center p-2 transition-colors group-hover:border-clay group-focus-visible:border-clay">
            <Show when={photo()} fallback={<p class="p-6 text-[12px] text-muted italic">{t('app.noPhotoThumb')}</p>}>
              <PhotoStage variant="thumb" />
            </Show>
          </div>
        </div>

        {/*
          Under the thumbnail, deliberately outside it: the thumbnail is the way back to
          sampling, and a sample point clicked here must select, not navigate.
          This is the same cloud as in Step 1 with the skeleton over it — the question Step 2
          asks is whether the scheme fits inside what the photograph holds.
        */}
        <Show when={photo()}>
          <div class="mt-3"><HueMap skeleton /></div>
        </Show>
        </div>

        <div>
          <Wheel />
          <div class="mt-4 flex justify-center">
            <div class="seg" role="tablist" aria-label={t('app.wheelViewAria')}>
              <For each={TABS}>
                {(tb) => (
                  <button role="tab" aria-pressed={tab() === tb.id} onClick={() => setTab(tb.id)}>{t(tb.labelKey)}</button>
                )}
              </For>
            </div>
          </div>
        </div>

        <div class="lg:col-span-2 xl:col-span-1">
          <Show when={tab() === 'guide'} fallback={<ColorValues />}>
            <HarmonyPanel />
          </Show>
        </div>
      </div>
    </section>
  );
}
