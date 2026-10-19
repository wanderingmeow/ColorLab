import { For, Show, createEffect, createMemo } from 'solid-js';
import { t } from '../i18n/index.ts';
import { hslToHex, readableOn, wheelColor } from '../lib/color.ts';
import { sampler } from '../lib/image.ts';
import { activeFit } from '../lib/analysis.ts';
import { dots, pixelsReady, sampleNumber, selected, setSelected } from '../lib/store.ts';
import { polar } from '../lib/wheel.ts';

/*
  One coordinate space, scaled to whatever column it lands in: the canvas is painted at this
  size × device pixels and the SVG over it is viewBox'd, so a 220px column and a 340px one get
  the same picture at two scales instead of two sets of arithmetic.
*/
const S = 340;
const C = S / 2;
const R_OUT = S / 2 - 4;  // the hue ring, the one the wheel has too
const RING_W = 9;
const R_IN = R_OUT - RING_W;
const MID = (R_IN + R_OUT) / 2;
/** the cloud lives inside the ring, exactly as it does on the disc */
const DATA = R_IN - 3;
const DOT = 11;
/** a mark that reaches the rim must not be cut by the card's own edge */
const SAFE = DATA - DOT - 2;

/**
 * The photograph plotted in hue space, with the sample points on top of it.
 *
 * The wheel shows the colours you chose. This shows the colours you *have* — every pixel of
 * the photograph at its own colour, on the wheel's own axes — hue for the angle, saturation
 * for the radius, the same two `radiusFor` uses on the Natural disc — so a colour sits in the
 * same place in both circles. That is what makes them readable against each other: a cluster
 * with no numbered dot on it is a colour the sample list does not hold.
 *
 * It is drawn on a dark ground because the dots are the photograph's own colours, including
 * its darks; on cream those disappear. Nothing here names a cluster — the app knows OKLCh
 * numbers, not that one of them is skin — so the map shows the shape and you bring the word.
 *
 * `skeleton` puts the active harmony's slots over the cloud, which is the question Step 2
 * actually asks: does this scheme fit inside what the photograph holds?
 */
export function HueMap(props: { skeleton?: boolean; compact?: boolean }) {
  let canvas!: HTMLCanvasElement;

  /*
   * `pixelsReady()`, not `photo()`. The photo signal is set the moment the file is chosen;
   * the decoded pixels arrive some time later, and the pixel layer is not reactive — so a
   * memo that depended on the photo computed against an empty sampler, cached the empty
   * answer, and told the reader the photograph had no chroma in it. That is the same trap a
   * click used to fall into: the picture on screen is not the picture you can read.
   */
  const points = createMemo(() => (pixelsReady() ? sampler.huePoints() : []));
  const fit = createMemo(() => (props.skeleton ? activeFit() : null));

  /**
   * The sample points, plotted with the same radius the pixels are.
   *
   * They sit at the hue they measured, never at a Custom intent: this map is what the
   * photograph holds, and a dot drawn at a colour it does not have is the canvas lying.
   */
  const marks = createMemo(() => dots().map((d) => {
    // the wheel's own axes: the same angle and radius it puts this dot at
    const p = polar(C, C, d.hsl.h, (d.hsl.s / 100) * SAFE);
    return { ...d, n: sampleNumber(d.id), x: p.x, y: p.y };
  }));

  createEffect(() => {
    const pts = points();
    const el = canvas;
    if (!el) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    el.width = Math.round(S * dpr);
    el.height = Math.round(S * dpr);
    const ctx = el.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#221e1b';
    ctx.fillRect(0, 0, S, S);

    /*
      The hue ring. Without it this is a black square with dust in it: the ring is what tells
      you which way round the cloud is, and it is painted with `wheelColor` — the one model
      the disc is painted with — so the colour at 30° here is the colour at 30° on the wheel.
      Segments overlap by a sixth of a degree so the joins do not show.
    */
    ctx.lineWidth = RING_W;
    const step = Math.PI / 180;
    for (let d = 0; d < 360; d += 1) {
      const a = -((d + 0.5) * Math.PI) / 180;
      ctx.strokeStyle = wheelColor(d, 1);
      ctx.beginPath();
      ctx.arc(C, C, MID, a - step * 0.6, a + step * 0.6);
      ctx.stroke();
    }

    // the thirds are what the radius means: grey at the middle, full saturation at the ring
    ctx.strokeStyle = 'rgba(250,246,238,.09)';
    ctx.lineWidth = 1;
    for (const f of [1 / 3, 2 / 3]) {
      ctx.beginPath();
      ctx.arc(C, C, DATA * f, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Big enough to overlap, translucent enough that the overlap still means something: at a
    // pixel and a half the photograph reads as scattered stars rather than a body with a
    // silhouette. Where the frame holds many pixels of one colour they pile up and go solid.
    const r = Math.max(1.7, S / 150);
    for (const p of pts) {
      const q = polar(C, C, p.hue, p.r * DATA);
      ctx.fillStyle = `${p.hex}8c`;
      ctx.beginPath();
      ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  return (
    /*
      No paragraph under the title in either step: both cards are asked to be a picture you
      read at a glance, and the sentence — what the cloud is, that the skeleton has to live
      inside it — is a hover away rather than a block of text above the thing it describes.
    */
    <div class="card p-4" title={t(props.skeleton ? 'map.noteHarmony' : 'map.noteSampling')}>
      <h3 class="display text-[15px]">{t('map.title')}</h3>

      <div class="relative mx-auto mt-3 overflow-hidden rounded" style={{ 'aspect-ratio': '1', 'max-width': `${props.compact ? 210 : S}px` }}>
        <canvas ref={canvas} class="block h-full w-full" />

        <Show when={points().length === 0}>
          <p class="absolute inset-0 grid place-items-center px-8 text-center text-[11.5px] leading-snug text-[#a99e92]">
            {t('map.noHues')}
          </p>
        </Show>

        <svg viewBox={`0 0 ${S} ${S}`} class="absolute inset-0 h-full w-full" aria-label={t('map.title')} role="group">
          <Show when={fit()}>{(f) => (
            <For each={f().slots}>
              {(slot) => {
                const p = polar(C, C, slot, MID);
                return (
                  <g>
                    <line x1={C} y1={C} x2={p.x} y2={p.y} stroke="rgba(250,246,238,.32)" stroke-width="1" stroke-dasharray="3 4" />
                    <circle cx={p.x} cy={p.y} r="5" fill={hslToHex({ h: slot, s: 70, l: 55 })}
                      stroke="rgba(250,246,238,.75)" stroke-width="1" />
                  </g>
                );
              }}
            </For>
          )}</Show>

          <For each={marks()}>
            {(m) => (
              <g
                role="button" tabindex={0} class="cursor-pointer"
                opacity={m.ignored ? 0.35 : 1}
                aria-label={t('map.dotAria', { n: m.n, hex: m.hex })}
                onClick={() => setSelected(m.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(m.id); } }}
              >
                <circle
                  cx={m.x} cy={m.y} r={DOT}
                  fill={m.hex}
                  stroke={selected() === m.id ? '#b0562f' : 'rgba(255,255,255,.92)'}
                  stroke-width={selected() === m.id ? 2.5 : 1.5}
                />
                <text x={m.x} y={m.y} text-anchor="middle" dominant-baseline="central"
                  font-family="var(--font-mono)" font-size="11" fill={readableOn(m.hex)}>{m.n}</text>
              </g>
            )}
          </For>
        </svg>
      </div>

    </div>
  );
}
