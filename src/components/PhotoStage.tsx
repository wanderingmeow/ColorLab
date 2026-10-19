import { For, Show, createSignal } from 'solid-js';
import { IconLock } from './Icons.tsx';
import { Loupe } from './Loupe.tsx';
import { t } from '../i18n/index.ts';
import { readableOn } from '../lib/color.ts';
import { sampler } from '../lib/image.ts';
import {
  addSample, loadFile, photo, pixelsReady, removeSample, sampleNumber, selected, setSelected, samples, updateSample, sampleSize,
} from '../lib/store.ts';

export function PhotoStage(props: { variant?: 'full' | 'thumb' }) {
  const thumb = () => props.variant === 'thumb';
  const stage = () => stageEl;
  let stageEl!: HTMLDivElement;

  const [drag, setDrag] = createSignal<{ id: string; mode: 'new' | 'move' } | null>(null);
  const [hover, setHover] = createSignal<{ u: number; v: number } | null>(null);
  const [over, setOver] = createSignal(false);
  const [swapping, setSwapping] = createSignal(false);
  const [swapErr, setSwapErr] = createSignal('');

  /**
   * Drop another frame straight onto the photo. The points stay put and re-read themselves
   * from the new picture — which is the whole point: sample, grade in the editor, drop the
   * result back here, and see what the harmony says now.
   */
  async function swap(file: File | undefined | null) {
    if (!file) return;
    setSwapErr(''); setSwapping(true);
    try { await loadFile(file); }
    catch (e) { setSwapErr(e instanceof Error ? e.message : t('upload.errorFallback')); }
    finally { setSwapping(false); setOver(false); }
  }

  const list = samples;

  /**
   * Where a pointer event puts the sample point — short of the frame by half the sample
   * area, so no reading is ever taken from pixels that are not in the photo.
   */
  function pos(e: PointerEvent) {
    const el = stage();
    const r = el.getBoundingClientRect();
    return sampler.clampToSample((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, sampleSize());
  }


  function onDown(e: PointerEvent) {
    if (thumb()) return;
    // no pixels, no sample: the photo is on screen but still decoding
    if (!pixelsReady()) return;
    e.preventDefault();
    const target = (e.target as HTMLElement).closest('[data-dot]') as HTMLElement | null;
    const p = pos(e);
    if (target) {
      const id = target.dataset.dot!;
      setSelected(id);
      setDrag({ id, mode: 'move' });
    } else {
      const hex = sampler.sampleAt(p.u, p.v, sampleSize());
      if (!hex) return;
      const id = addSample(hex, p.u, p.v);
      setDrag({ id, mode: 'new' });
    }
    setHover(p);
    stageEl.setPointerCapture(e.pointerId);
  }

  function onMove(e: PointerEvent) {
    if (thumb()) return;
    const p = pos(e);
    const d = drag();
    if (d) {
      const hex = sampler.sampleAt(p.u, p.v, sampleSize());
      if (hex) updateSample(d.id, { hex, x: p.u, y: p.v }, false);
    }
    setHover(p);
  }

  function onUp(e: PointerEvent) {
    if (drag()) {
      try { stageEl.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    }
    setDrag(null);
    setHover(null);
  }

  function onKey(e: KeyboardEvent, id: string, x: number, y: number) {
    const step = e.shiftKey ? 0.02 : 0.004;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
    };
    if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key];
      const p = sampler.clampToSample(x + dx, y + dy, sampleSize());
      updateSample(id, { x: p.u, y: p.v });
      const hex = sampler.sampleAt(p.u, p.v, sampleSize());
      if (hex) updateSample(id, { hex }, false);
    }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSample(id); }
  }

  return (
    <div
      class="relative inline-block max-w-full align-top"
      onDragOver={(e) => { if (thumb()) return; e.preventDefault(); setOver(true); }}
      onDragLeave={(e) => {
        // leaving a child element fires this too; only a real exit from the photo counts
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(e) => {
        if (thumb()) return;
        e.preventDefault();
        void swap(e.dataTransfer?.files?.[0]);
      }}
    >
      <Show when={photo()}>
        {(p) => (
          <img
            src={p().src}
            alt={p().name}
            class={`block max-w-full select-none ${thumb() ? 'max-h-[220px]' : 'max-h-[min(66vh,760px)]'}`}
            draggable={false}
          />
        )}
      </Show>

      {/* the photo paints from its data URL before the sampler has pixels to read */}
      <Show when={photo() && !pixelsReady()}>
        <div class="absolute inset-0 grid place-items-center bg-[#faf6ee]/75 text-[13px] text-ink-2">
          {t('stage.preparing')}
        </div>
      </Show>

      <Show when={over() || swapping()}>
        <div class="pointer-events-none absolute inset-0 grid place-items-center border-2 border-dashed border-[#b0562f] bg-[#faf1ea]/85">
          <span class="rounded bg-white/95 px-3 py-1.5 text-[13px] font-medium text-[#8a3f22] shadow-[0_2px_10px_rgba(0,0,0,.12)]">
            {swapping() ? t('upload.busy') : t('stage.dropReplace')}
          </span>
        </div>
      </Show>

      <Show when={swapErr()}>
        <div class="absolute inset-x-0 bottom-0 bg-[#7a3520]/92 px-3 py-1.5 text-[12px] text-white">{swapErr()}</div>
      </Show>

      {/* dot layer */}
      <div
        ref={stageEl}
        class={`absolute inset-0 ${thumb() ? '' : 'no-select cursor-crosshair'}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        role="group"
        aria-label={t('stage.groupAria')}
      >
        <For each={list()}>
          {(s, i) => (
            <button
              type="button"
              data-dot={s.id}
              class="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%` }}
              classList={{ 'z-10': selected() === s.id }}
              onClick={(e) => { e.stopPropagation(); setSelected(s.id); }}
              onKeyDown={(e) => onKey(e, s.id, s.x, s.y)}
              aria-label={t('stage.dotAria', { n: sampleNumber(s.id), label: s.label || s.hex })}
              aria-pressed={selected() === s.id}
            >
              <span
                class={`grid place-items-center rounded-full border-2 border-white/90 font-medium shadow-[0_1px_5px_rgba(0,0,0,.45)] ${thumb() ? 'h-4 w-4 text-[9px]' : 'h-[26px] w-[26px] text-[12px]'} ${s.ignored ? 'opacity-45' : ''}`}
                style={{
                  background: s.hex,
                  color: readableOn(s.hex),
                  // flush against the white ring: an offset here draws the selection ring
                  // away from the dot and the gap between them is the photograph showing
                  // through, which reads as an empty circle rather than a selection
                  'outline': selected() === s.id ? '2px solid #b0562f' : 'none',
                  'outline-offset': '0px',
                }}
              >
                {sampleNumber(s.id)}
              </span>
              {/*
                The lock says "locked", the way the list and the wheel say it. It used to be a
                dark disc with a 7px ● dropped into it, which at any size read as a thick black
                ring with a pinhole in the middle and announced nothing at all.
              */}
              <Show when={s.locked}>
                <span
                  class={`absolute -right-1.5 -top-1.5 grid place-items-center rounded-full bg-[#fffdf9] shadow-[0_1px_3px_rgba(0,0,0,.45)] ${thumb() ? 'h-3 w-3' : 'h-4 w-4'}`}
                  title={t('sample.lock')}
                >
                  <IconLock size={thumb() ? 7 : 9} open={false} class="text-clay" />
                </span>
              </Show>
            </button>
          )}
        </For>
      </div>

      {/* the magnifier that follows a drag; it flips to stay on screen — see Loupe.tsx */}
      <Loupe at={() => drag() && hover() ? hover() : null} stage={() => stageEl} drag={drag} />
    </div>
  );
}
