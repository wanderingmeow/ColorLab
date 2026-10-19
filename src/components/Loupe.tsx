import { Show, createEffect, createSignal } from 'solid-js';
import { t } from '../i18n/index.ts';
import { Sampler, sampler } from '../lib/image.ts';
import { sampleSize, samples } from '../lib/store.ts';

const LOUPE = 122;
const RING = 3;       // the white circle around the canvas
const CAPTION = 34;   // the hex line, plus the edge warning when it shows
const GAP = 16;       // keep this much clear between the cursor and the loupe

/**
 * The magnifier that follows a drag: what the sample area actually covers, and what it reads.
 *
 * It exists because a sample is an area and a photograph has edges. A point that looks
 * perfectly placed can have half its patch on the fur and half on the background behind it,
 * and the median of two colours is the colour of nothing — so the loupe shows the area, and
 * says so when the area straddles something.
 */
/**
 * The lens itself, as a component rather than a bare canvas inside the `<Show>`.
 *
 * The draw has to happen after the canvas exists. An effect created in the parent's body is
 * registered before `<Show>` has built its content, so it ran against a canvas that was not
 * on the page — and a loupe that appears for a single position (a click, one arrow-key nudge)
 * never got a second chance to draw. Mounted here, the canvas is real by the time the effect
 * runs, so the lens paints on the way in.
 */
function LoupeLens(props: {
  at: () => { u: number; v: number } | null;
  report: (patch: { hex: string; spread: number } | null) => void;
}) {
  let canvas!: HTMLCanvasElement;
  createEffect(() => {
    const h = props.at();
    const size = sampleSize();
    if (!h) return;
    const ctx = canvas?.getContext('2d');
    if (ctx) sampler.drawZoom(ctx, LOUPE, h.u, h.v, size);
    const hex = sampler.sampleAt(h.u, h.v, size);
    props.report(hex ? { hex, spread: sampler.spreadAt(h.u, h.v, size, hex) } : null);
  });
  return (
    <canvas ref={canvas} width={LOUPE} height={LOUPE}
      style={{ width: `${LOUPE}px`, height: `${LOUPE}px` }} />
  );
}

export function Loupe(props: {
  at: () => { u: number; v: number } | null;
  stage: () => HTMLElement | undefined;
  drag: () => { id: string } | null;
}) {
  /** what the sample area under the cursor reads, and how flat it is */
  const [patch, setPatch] = createSignal<{ hex: string; spread: number } | null>(null);

  /**
   * Above-right of the cursor, flipping to whichever side the *screen* has room for. The
   * screen is the right measure rather than the photo: the loupe is allowed to hang outside
   * the frame, but not off the window.
   */
  const place = () => {
    const h = props.at();
    const el = props.stage();
    if (!h || !el) return { display: 'none' };
    const box = LOUPE + RING * 2;
    const r = el.getBoundingClientRect();
    const y = r.top + h.v * r.height;
    const x = r.left + h.u * r.width;
    const below = y - GAP - box - CAPTION < 0;
    const mirror = x + GAP + box > window.innerWidth;
    return {
      left: mirror ? `calc(${h.u * 100}% - ${GAP + box}px)` : `calc(${h.u * 100}% + ${GAP}px)`,
      top: below ? `calc(${h.v * 100}% + ${GAP}px)` : `calc(${h.v * 100}% - ${GAP + box + CAPTION}px)`,
    };
  };

  return (
    <Show when={props.at()}>
      <div class="pointer-events-none absolute z-30 flex flex-col items-start" style={place()}>
        <div class="rounded-full border-[3px] border-white/95 shadow-[0_6px_22px_rgba(0,0,0,.4)] overflow-hidden">
          <LoupeLens at={props.at} report={setPatch} />
        </div>
        <div class="mt-1 self-center rounded bg-[#171412]/85 px-2 py-1 text-center font-mono text-[11px] text-white">
          {/* while dragging, the number is the dot's own reading — the same one the list shows */}
          {props.drag() ? samples().find((s) => s.id === props.drag()!.id)?.hex ?? '' : patch()?.hex ?? ''}
          <Show when={(patch()?.spread ?? 0) > Sampler.EDGE_SPREAD}>
            <span class="block text-[9.5px] leading-tight text-[#e8c79a]" title={t('stage.edgeHint')}>
              {t('stage.edge')}
            </span>
          </Show>
        </div>
      </div>
    </Show>
  );
}
