import { For, Show } from 'solid-js';
import { harmonyLabel, hueBucket, hueLabel, t } from '../i18n/index.ts';
import { chromaRatio, hexToHsl, hslDelta } from '../lib/color.ts';
import { HARMONY_ORDER, NEUTRAL_FLOOR, staffable, suggestionText } from '../lib/harmonies.ts';
import type { HarmonyType, RetargetMode, Suggestion } from '../lib/harmonies.ts';

/** what `dots()` hands back: a sample plus its HSL and plotting hue */
type Dot = ReturnType<typeof dots>[number];
import { activeFit, activeType, isAuto, ranked } from '../lib/analysis.ts';
import { measureSeparation } from '../lib/separation.ts';
import {
  dots, retargetMode, selected, setCustomHue, setHarmony, setRetargetMode, setShowHints,
  setSelected, sampleNumber, showHints, updateSample,
} from '../lib/store.ts';
import { useCopy } from '../lib/ui.ts';
import { HarmonyGlyph, IconCopy, IconLock, IconUndo } from './Icons.tsx';

/** Dots the user has placed a target on in Custom mode. */
const placedTargets = () => dots().filter((d) => d.custom !== undefined);

/**
 * The photo's own spread, over the colours the analysis is working with. Ignored dots are left
 * out because the reader already said those colours do not count.
 */
const sep = () => measureSeparation(dots().filter((d) => !d.ignored).map((d) => d.hex));

/** Offered in the "Move" control, in the order they are shown. */
const MODES: RetargetMode[] = ['relative', 'hue'];

/**
 * One dot's verdict: what it is, what to do about it, and the lock that overrides that.
 *
 * It takes the suggestion and the dot as plain values, not accessors, because <For> keys on
 * the suggestion object and `fit()` hands back fresh objects on every recompute — a row can
 * never outlive the advice it was written for. If that ever changes, this needs accessors.
 */
function SuggestionRow(props: { s: Suggestion; d: Dot }) {
  const { s, d } = props;
  const { copied, copy } = useCopy();
        const neutral = chromaRatio(d.hex) < NEUTRAL_FLOOR;
        const hueWord = () => hueLabel(s.targetHue ?? 0);
        return (
          <div class="row" data-selected={selected() === d.id} classList={{ 'opacity-55': d.ignored }}
            onClick={() => setSelected(d.id)}>
            <span class="mono-meta pt-[9px]">{sampleNumber(d.id)}</span>
            <span class="swatch mt-[2px]" style={{ background: d.hex }} aria-hidden="true" />
            <div class="min-w-0">
              <div class="truncate text-[13px] font-semibold">{d.label || <span class="italic font-normal text-muted">{t('sample.unnamed')}</span>}</div>
              {/* the hex and the word it spells are one reading, so they share one line —
                  on its own below the hex the colour word looked like a footnote to it */}
              <div class="mt-[2px] flex flex-wrap items-center gap-1.5">
                <button class="flex items-center gap-1.5 font-mono text-[12px] text-ink-2 hover:text-clay"
                  onClick={(e) => { e.stopPropagation(); copy(d.hex, d.id); }} title={t('sample.copyHex')}>
                  {d.hex}<IconCopy size={12} class={copied() === d.id ? 'text-clay' : 'opacity-45'} />
                </button>
                <span class="text-[12px] text-muted">· {hueLabel(d.hsl.h)}</span>
              </div>

              <Show when={s.kind === 'aligned'}>
                <div class="mt-1 text-[12.5px] text-good">{t('harmony.aligned')}</div>
              </Show>
              <Show when={s.kind === 'ignored'}>
                <div class="mt-1 text-[12.5px] text-muted italic">{t('harmony.ignored')}</div>
              </Show>
              <Show when={s.kind === 'locked'}>
                <div class="mt-1 flex items-center gap-1 text-[12.5px] text-clay">
                  <IconLock size={11} /> {t('adj.locked')}
                </div>
                <Show when={showHints()}>
                  <p class="mt-1 rounded bg-[#f3ead9] px-2 py-1 text-[11.5px] leading-snug text-[#7a5a25]">
                    {t('harmony.lockedHint', { deg: Math.abs(Math.round(s.delta ?? 0)) })}
                  </p>
                </Show>
              </Show>
              <Show when={s.kind === 'inert'}>
                <div class="mt-1 text-[12.5px] text-muted italic">{t('adj.inert')}</div>
                <Show when={showHints()}>
                  <p class="mt-1 rounded bg-[#f3ead9] px-2 py-1 text-[11.5px] leading-snug text-[#7a5a25]">
                    {t('harmony.inertNote', {
                      de: (s.deltaE ?? 0).toFixed(1),
                      s: Math.round(d.hsl.s),
                      hue: hueWord(),
                    })}
                  </p>
                </Show>
              </Show>
              <Show when={s.kind === 'shift'}>
                <div class="mt-1 text-[12.5px] text-clay">
                  {suggestionText(s, t)}
                  <span class="mono-meta ml-1">{t('harmony.degrees', { deg: Math.abs(Math.round(s.delta ?? 0)) })}</span>
                </div>
                <HslRow from={d.hex} to={s.targetHex ?? d.hex} />
                {/*
                  A hex and its copy icon are one thing and must break as one thing. This
                  button used to be plain inline flow, so in a narrow column the hex took the
                  line and the icon fell underneath it — a copy affordance on a line of its
                  own, belonging to nobody. Flex keeps them together; flex-wrap on the row
                  moves the whole group down instead.
                */}
                <div class="mt-0.5 flex flex-wrap items-center gap-1.5">
                  <span class="shrink-0 text-[11.5px] text-muted">{t('harmony.suggested')}</span>
                  <span class="h-3 w-3 shrink-0 rounded-[2px] border border-black/15" style={{ background: s.targetHex }} />
                  <button class="flex shrink-0 items-center gap-1 whitespace-nowrap font-mono text-[11.5px] text-ink-2 hover:text-clay"
                    onClick={(e) => { e.stopPropagation(); copy(s.targetHex ?? '', `t${s.id}`); }}
                    title={t('sample.copyHex')}>
                    {s.targetHex}
                    <IconCopy size={11} class={copied() === `t${s.id}` ? 'text-clay' : 'opacity-45'} />
                  </button>
                </div>
                <Show when={showHints() && neutral}>
                  <p class="mt-1 rounded bg-[#f3ead9] px-2 py-1 text-[11.5px] leading-snug text-[#7a5a25]">
                    {t('harmony.neutralHint', { s: Math.round(d.hsl.s), hue: hueWord() })}
                  </p>
                </Show>
              </Show>
            </div>
            <button
              class="btn btn-quiet self-end !px-1 !py-0.5"
              title={d.locked ? t('sample.unlock') : t('sample.lock')}
              onClick={(e) => { e.stopPropagation(); updateSample(d.id, { locked: !d.locked }); }}
            >
              <IconLock size={13} open={!d.locked} class={d.locked ? 'text-clay' : 'opacity-45'} />
            </button>
          </div>
        );
}

/**
 * The answer to "so which slider, by how much": one box per channel, the relative move in
 * big type and the absolute current → target in small type underneath.
 */
function HslRow(props: { from: string; to: string }) {
  const cells = () => {
    const a = hexToHsl(props.from), b = hexToHsl(props.to), d = hslDelta(props.from, props.to);
    return [
      { key: 'h', delta: d.h, from: Math.round(a.h), to: Math.round(b.h), unit: '°' },
      { key: 's', delta: d.s, from: Math.round(a.s), to: Math.round(b.s), unit: '%' },
      { key: 'l', delta: d.l, from: Math.round(a.l), to: Math.round(b.l), unit: '%' },
    ];
  };
  const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  return (
    <div class="mt-1.5 grid grid-cols-3 gap-1">
      <For each={cells()}>
        {(c) => (
          <div class="rounded bg-[#f4ece0] px-1 py-1 text-center"
            title={t('hsl.cell', {
              from: c.from, to: c.to, unit: c.unit,
              delta: c.delta === 0 ? t('hsl.none') : sign(c.delta),
            })}>
            <div class="mono-meta text-[9px] uppercase opacity-70">{t(`hsl.${c.key}`)}</div>
            <div class="font-mono text-[13px] leading-tight tabular-nums"
              classList={{ 'text-clay font-semibold': c.delta !== 0, 'opacity-45': c.delta === 0 }}>
              {c.delta === 0 ? '0' : sign(c.delta) + c.unit}
            </div>
            <div class="font-mono text-[9.5px] tabular-nums opacity-55">
              {c.from}→{c.to}
            </div>
          </div>
        )}
      </For>
    </div>
  );
}

/**
 * "Try another harmony", and the two switches that change what the advice means.
 *
 * A scheme the samples cannot carry is shown disabled with the reason in its tooltip, and the
 * scores stay visible, so the choice is made with the number in view rather than hidden from
 * it: the automatic answer is a suggestion, and this is where you overrule it.
 */
function HarmonyPicker() {
  /** can these samples carry this harmony — and if not, what is missing */
  const staff = (h: HarmonyType) => staffable(h, dots());
  const whyOff = (h: HarmonyType): string => {
    const a = staff(h);
    if (a.reason === 'arms') return t('harmony.needArms', { n: a.need, have: a.have });
    if (a.reason === 'dots') return t('harmony.needDots', { n: a.slots, have: a.dots });
    return t(`harmonyFeeling.long.${h}`);
  };

  const scoreOf = (h: HarmonyType) => ranked().find((f) => f.type === h)?.score;

  return (
  <div class="border-t border-line pt-3">
    <span class="eyebrow">{t('harmony.tryAnother')}</span>
    <div class="mt-2 grid grid-cols-2 gap-2">
      <For each={HARMONY_ORDER}>
        {(h: HarmonyType) => {
          const off = () => !staff(h).ok;
          return (
          <button class="hbtn" aria-pressed={activeType() === h} disabled={off()}
            classList={{ 'opacity-45': off(), 'cursor-not-allowed': off() }}
            onClick={() => { if (!off()) setHarmony(h); }}
            title={whyOff(h)}>
            <HarmonyGlyph type={h} size={15} class="shrink-0" />
            {/*
              The name of the thing you are being asked to choose is the one thing this button
              may not hide. It used to say `truncate`, but `items-start` sized this box to its
              content, so no ellipsis ever came and "Double Split-Complementary" painted
              straight over the score. Long names wrap now, and .hbtn clips as a guarantee.
            */}
            <span class="flex min-w-0 flex-col leading-tight">
              <span class="break-words">{harmonyLabel(h)}</span>
              {/* the emotional register, so the choice is made on intent and not on the number */}
              <span class="note text-[10px] opacity-70">{t(`harmonyFeeling.short.${h}`)}</span>
            </span>
            <Show when={scoreOf(h) !== undefined}>
              <span class="ml-auto shrink-0 font-mono text-[10.5px] opacity-60">{scoreOf(h)}</span>
            </Show>
          </button>
          );
        }}
      </For>
    </div>
    <Show when={activeType() === 'custom'}>
      <p class="note mt-2 text-[12px]">{t('harmony.customNote')}</p>
      <Show when={placedTargets().length}>
        <div class="mt-2 flex items-center gap-2">
          <span class="mono-meta">{t('harmony.moves', { n: placedTargets().length })}</span>
          <button
            class="hbtn !px-2 !py-1 text-[12px]"
            onClick={() => setCustomHue({})}
            title={t('harmony.restoreMoves')}
          >
            <IconUndo size={13} />
            {t('harmony.restoreMoves')}
          </button>
        </div>
      </Show>
    </Show>
    <div class="mt-1.5 flex items-center gap-2">
      <label class="flex items-center gap-1.5 text-[11.5px] text-muted cursor-pointer">
        <input type="checkbox" checked={showHints()} class="accent-[#b0562f]"
          onChange={(e) => setShowHints((e.currentTarget as HTMLInputElement).checked)} />
        {t('harmony.flagInvisible')}
      </label>
    </div>

    {/* which sliders the suggestion is allowed to touch */}
    <div class="mt-2 flex flex-wrap items-center gap-2">
      <span class="eyebrow">{t('harmony.moveLabel')}</span>
      <div class="seg seg-sm" role="group" aria-label={t('harmony.moveLabel')}>
        <For each={MODES}>
          {(m) => (
            <button aria-pressed={retargetMode() === m} onClick={() => setRetargetMode(m)}
              title={t(m === 'relative' ? 'harmony.moveRelativeNote' : 'harmony.moveHueNote')}>
              {t(m === 'relative' ? 'harmony.moveRelative' : 'harmony.moveHue')}
            </button>
          )}
        </For>
      </div>
    </div>
    <p class="note mt-1 text-[11px] leading-snug">
      {t(retargetMode() === 'relative' ? 'harmony.moveRelativeNote' : 'harmony.moveHueNote')}
    </p>
  </div>
  );
}

export function HarmonyPanel() {
  const fit = activeFit;

  return (
    <aside class="card p-4 flex flex-col gap-3">
      {/* 1 — the verdict */}
      <div class="rounded bg-[#f6efe7] px-3 py-3">
        <div class="flex items-baseline justify-between">
          <span class="eyebrow">{isAuto() ? t('harmony.detected') : t('harmony.yours')}</span>
          <Show when={!isAuto()}>
            <button class="text-[11.5px] text-clay hover:underline" onClick={() => setHarmony('auto')}>{t('harmony.backToDetected')}</button>
          </Show>
        </div>
        <div class="display text-[26px] leading-tight mt-0.5">{harmonyLabel(activeType())}</div>
        <Show when={fit()}>
          {(f) => (
            <>
              <p class="note text-[12.5px] mt-0.5">{t('harmony.builtAround', { list: f().builtAround.map(hueBucket).join(' · ') })}</p>
              <Show when={!f().arms.ok}>
                <p class="mt-1.5 rounded border border-[#e0c9ad] bg-[#faf1e6] px-2 py-1.5 text-[12px] leading-snug text-[#8a6a33]">
                  {f().arms.reason === 'dots'
                    ? t('harmony.needDots', { n: f().arms.slots, have: f().arms.dots })
                    : t('harmony.degenerate', { n: f().arms.need, have: f().arms.have })}
                </p>
              </Show>
              <div class="mt-2 border-t border-[#e4d9cb] pt-2">
                <span class="eyebrow">{t('harmony.feelingLabel')}</span>
                <p class="mt-0.5 text-[12.5px] leading-relaxed text-ink-2">{t(`harmonyFeeling.long.${activeType()}`)}</p>
              </div>
              <div class="mt-2">
                <div class="flex items-baseline justify-between">
                  <span class="eyebrow">{t('harmony.harmonyScoreLabel')}</span>
                  <span class="font-mono text-[12px] tabular-nums">{f().score}%</span>
                </div>
                <div class="mt-1 h-[3px] rounded-full bg-[#ded2c4] overflow-hidden">
                  <div class="h-full bg-[#171412]" style={{ width: `${f().score}%` }} />
                </div>
              </div>

              {/*
                The other axis, kept apart on purpose. Harmony asks how well the colours sit on one
                skeleton; separation asks how far they pull apart. Pair preference and pair harmony
                both rise as hues get MORE similar, while a figure colour is liked more the further
                it is pulled from its background — folding the two into one number would average
                away the only interesting part.
              */}
              <Show when={sep()}>
                {(s) => (
                  <div class="mt-2 rounded border border-[#e4d9cb] px-2 py-1.5">
                    <div class="flex items-baseline justify-between">
                      <span class="eyebrow">{t('harmony.separationLabel')}</span>
                      <span class="note text-[10.5px]">{t('harmony.separationHint')}</span>
                    </div>
                    <For
                      each={[
                        { key: 'warm', v: s().warmCool, label: t('harmony.warmCoolLabel'),
                          tip: t('harmony.warmCoolValue', { warm: s().warmest, cool: s().coolest }) },
                        { key: 'light', v: s().lightness, label: t('harmony.lightnessLabel'),
                          tip: t('harmony.lightnessValue', { dark: s().darkest, light: s().lightest }) },
                      ]}
                    >
                      {(row) => (
                        <div class="mt-1.5" title={row.tip}>
                          <div class="flex items-baseline justify-between">
                            <span class="text-[11.5px] text-ink-2">{row.label}</span>
                            <span class="font-mono text-[11px] tabular-nums text-muted">{row.v}</span>
                          </div>
                          <div class="mt-0.5 h-[3px] rounded-full bg-[#ded2c4] overflow-hidden">
                            <div class="h-full bg-[#a8703c]" style={{ width: `${row.v}%` }} />
                          </div>
                        </div>
                      )}
                    </For>
                    <p class="note mt-1.5 text-[11px] leading-snug">{t('harmony.separationNote')}</p>
                  </div>
                )}
              </Show>
              <details class="mt-2 group">
                <summary class="cursor-pointer text-[11.5px] text-muted hover:text-clay list-none">{t('harmony.why')}</summary>
                <dl class="mono-meta mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                  <dt>{t('harmony.drift')}</dt><dd>{f().driftMean.toFixed(1)}°</dd>
                  <dt>{t('harmony.slots')}</dt><dd>{Math.round(f().coverage * 100)}%</dd>
                  <dt>{t('harmony.worst')}</dt>
                  <dd>{(() => { const m = f().driftMax; return m ? `#${sampleNumber(m.id)} at ${m.value.toFixed(0)}°` : '—'; })()}</dd>
                  <dt>{t('harmony.weights')}</dt><dd>{t('harmony.weightsValue')}</dd>
                  <dt>{t('harmony.ignoredRow')}</dt>
                  <dd>{t('harmony.ignoredValue', {
                    byYou: dots().filter((d) => d.ignored).length,
                    neutral: dots().filter((d) => !d.ignored && chromaRatio(d.hex) < NEUTRAL_FLOOR).length,
                  })}</dd>
                </dl>
                <p class="note mt-1.5 text-[11px] leading-snug">{t('harmony.agreementValue')}</p>
              </details>
            </>
          )}
        </Show>
      </div>

      {/* 2 — what to move */}
      <div>
        <span class="eyebrow">{t('harmony.adjustments')}</span>
        <p class="mt-1 text-[11px] leading-snug text-muted">{t('harmony.hslLegend')}</p>
        <div class="mt-2 flex flex-col gap-2 overflow-y-auto pr-1" style={{ 'max-height': '40vh' }}>
          <For each={fit()?.suggestions ?? []}>
            {(s) => {
              const d = dots().find((x) => x.id === s.id);
              return d ? <SuggestionRow s={s} d={d} /> : null;
            }}
          </For>
        </div>
      </div>

      <HarmonyPicker />
    </aside>
  );
}
