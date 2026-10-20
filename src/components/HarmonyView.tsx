import { For, Show } from 'solid-js';
import { t } from '../i18n/index.ts';
import { photo, setStep, tab, setTab } from '../lib/store.ts';
import { ColorValues } from './ColorValues.tsx';
import { HarmonyAdjustments, HarmonyReading } from './HarmonyPanel.tsx';
import { HueMap } from './HueMap.tsx';
import { IconBack } from './Icons.tsx';
import { PhotoStage } from './PhotoStage.tsx';
import { Wheel } from './Wheel.tsx';

const TABS = [
  { id: 'natural', labelKey: 'wheel.tabNatural' },
  { id: 'pure', labelKey: 'wheel.tabPure' },
  { id: 'guide', labelKey: 'wheel.tabGuide' },
] as const;

/**
 * Step 2: read the harmony, and decide what to do about it.
 *
 * The band across the top holds the photograph and the cloud of colours it produced on the
 * left, and the step's own words on the right, set on the right margin. `items-stretch` makes
 * that one band: the thumbnail card and the chart card reach the same bottom line as the copy,
 * so the corner reads as a single row rather than three objects of convenience.
 *
 * Below it, three columns: the reading, the wheel, the workbench. Below `xl` they stack in the
 * order you actually want them in — the wheel, then what it says, then what to do.
 */
export function HarmonyView() {
  return (
    <section>
      <div class="flex flex-wrap items-stretch justify-between gap-6">
        {/* the photograph, and the cloud of colours that came out of it, side by side */}
        <div class="flex flex-wrap items-stretch gap-4">
          {/*
            The thumbnail is the way back to sampling. It is a div[role=button] because the
            thumbnail renders its own sample-point buttons, and buttons cannot nest; clicking a
            point here selects it instead of navigating. The card takes the leftover height
            (`flex-1`) and centres the photograph inside it: the photo keeps its own geometry,
            because a sample point is a position in the frame and a cropped thumbnail would put
            every one of them in the wrong place.
          */}
          <div
            role="button"
            tabindex={0}
            class="group flex w-[260px] shrink-0 cursor-pointer flex-col"
            title={t('app.backToSampling')}
            onClick={() => setStep('sample')}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setStep('sample'); } }}
          >
            <span class="eyebrow flex items-center gap-1.5 transition-colors group-hover:text-clay group-focus-visible:text-clay">
              <IconBack size={12} /> {t('app.yourPhoto')}
            </span>
            <div class="card mt-2 grid flex-1 place-items-center p-2 transition-colors group-hover:border-clay group-focus-visible:border-clay">
              <Show when={photo()} fallback={<p class="p-6 text-[12px] text-muted italic">{t('app.noPhotoThumb')}</p>}>
                <PhotoStage variant="thumb" />
              </Show>
            </div>
          </div>

          {/*
            Deliberately outside the thumbnail: the thumbnail navigates, and a sample point
            clicked here must select. This is the same cloud as in Step 1 with the skeleton over
            it — the question Step 2 asks is whether the scheme fits inside what the photograph
            holds, and that is a question about the whole frame, not about the few points you
            happened to place.
          */}
          <Show when={photo()}>
            <HueMap compact skeleton />
          </Show>
        </div>

        {/* the step's own words, pushed to the right edge and set on the right margin */}
        <div class="ml-auto w-fit max-w-[56ch] lg:text-right">
          <span class="eyebrow block">{t('app.step2Eyebrow')}</span>
          {/* the same `h1` argument as in Step 1: exactly one step is mounted at a time */}
          <h1 class="display mt-1 max-w-[24ch] text-[34px] leading-[1.12] sm:text-[38px] lg:ml-auto">
            {t('app.h2a')}<span class="accent">{t('app.h2Accent')}</span>{t('app.h2b')}
          </h1>
          <p class="mt-2 text-[14px] leading-relaxed text-ink-2">{t('app.step2Lead')}</p>
        </div>
      </div>

      {/*
        Three columns. The left one is the reading: which harmony was settled on, what it costs,
        what it feels like, and the controls that change the answer. The middle is the wheel. The
        right is the workbench — the list of moves, or the plain colour values in the other two
        views. They were one scrolling column before, which put the verdict, the wheel and the
        numbers in a queue where only one of them could be big. The left column is wide on purpose:
        its two-up harmony buttons carry a name that wraps, a mood word and a score, and at 250px
        the name was fighting the number for the same 90 pixels.
      */}
      <div class="mt-6 grid items-start gap-5 xl:grid-cols-[minmax(300px,360px)_minmax(0,1fr)_minmax(320px,380px)]">
        <div class="order-2 min-w-0 xl:order-none">
          <HarmonyReading />
        </div>

        <div class="order-1 min-w-0 xl:order-none">
          {/*
            The view switch sits above the wheel, not below it: it chooses how the wheel is
            drawn, and underneath it arrived after the readout, which made it look like a
            control for something else. Centred, because the wheel is centred.
          */}
          <div class="flex justify-center">
            <div class="seg" role="tablist" aria-label={t('app.wheelViewAria')}>
              <For each={TABS}>
                {(tb) => (
                  <button role="tab" aria-pressed={tab() === tb.id} onClick={() => setTab(tb.id)}>{t(tb.labelKey)}</button>
                )}
              </For>
            </div>
          </div>

          <div class="mt-3"><Wheel /></div>
        </div>

        <div class="order-3 min-w-0 xl:order-none">
          <Show when={tab() === 'guide'} fallback={<ColorValues />}>
            <HarmonyAdjustments />
          </Show>
        </div>
      </div>
    </section>
  );
}
