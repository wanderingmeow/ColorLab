import { createEffect, createSignal, For, Index, on, Show } from 'solid-js';
import { t } from '../i18n/index.ts';
import { sampler } from '../lib/image.ts';
import {
  addSamples, canAnalyze, clearAll, coverage, dots, MIN_SAMPLES, moveSample, pixelsReady, removeSample, samples,
  selected, setSelected, SUGGEST_MAX, undo, updateSample, sampleSize, setSampleSize, SAMPLE_SIZES,
  type SampleSize,
  sampleNumber,
} from '../lib/store.ts';
import { useCopy } from '../lib/ui.ts';
import { ColourReading } from './ColourReading.tsx';
import { IconArrow, IconClose, IconEyeOff, IconGrip, IconLock, IconSparkle, IconTrash, IconUndo } from './Icons.tsx';


/** What a drag is doing right now: which row is lifted, and where it would land. */
export type Reorder = {
  start: (id: string, e: DragEvent) => void;
  over: (id: string, e: DragEvent) => void;
  drop: (id: string, e: DragEvent) => void;
  end: () => void;
  key: (id: string, e: KeyboardEvent) => void;
  /** '' | 'above' | 'below' — the insertion line to draw on this row. */
  edge: (id: string) => string;
  dragging: (id: string) => boolean;
};

/**
 * Where a dropped row actually lands.
 *
 * `moveSample` inserts into the list with the moved row already lifted out, and that is
 * exactly what "put it here" means once the removal has happened — so the index is looked up
 * in the shortened list, then nudged past the target when the pointer was on its lower half.
 */
export function dropIndex(list: { id: string }[], from: string, onto: string, edge: 'above' | 'below'): number {
  const after = list.filter((s) => s.id !== from);
  const at = after.findIndex((s) => s.id === onto);
  if (at < 0) return list.length - 1;
  return at + (edge === 'below' ? 1 : 0);
}

/**
 * One sample: its name, its reading, the three switches on the right, and the number itself
 * as the handle you drag it by.
 *
 * `d` arrives as an accessor because the list is keyed by position. Renaming a sample
 * replaces its object, so a row that took a snapshot would keep showing the old name while
 * the field beside it typed the new one — and that is the same thing that makes a row show
 * its new number the moment it is reordered.
 */
function SampleRow(props: {
  d: () => ReturnType<typeof dots>[number];
  copied: () => string | null;
  copy: (text: string, id: string) => void;
  reorder: Reorder;
}) {
  const d = props.d;
  const { copy } = props;
  const copied = props.copied;
  return (
    <div class="row group" data-sample-id={d().id} data-selected={selected() === d().id}
      data-drop={props.reorder.edge(d().id)} data-dragging={props.reorder.dragging(d().id)}
      onClick={() => setSelected(d().id)}
      onDragOver={(e) => props.reorder.over(d().id, e)}
      onDrop={(e) => props.reorder.drop(d().id, e)}
    >
      {/*
        The handle is the whole left strip of the row, top to bottom — a 14px number was a
        target you had to already know about. It carries the number because the number is the
        thing reordering changes: drag it and everything that reads `sampleNumber` — this row,
        the dot on the photo, the chip on the wheel — moves together. The grip says what the
        strip is before anybody tries it, and the strip is tinted on hover so the area that
        answers is visible. Alt+↑/↓ does the same move without a pointer.
      */}
      {/* keeps the column the handle sits in, so the grid does not shift when the handle
          leaves the flow */}
      <span aria-hidden="true" />
      <span
        class="draghandle"
        draggable="true"
        role="button"
        tabindex={0}
        data-handle
        title={t('sample.reorder')}
        aria-label={t('sample.reorderAria', { n: sampleNumber(d().id) })}
        onDragStart={(e) => props.reorder.start(d().id, e)}
        onDragEnd={() => props.reorder.end()}
        onKeyDown={(e) => props.reorder.key(d().id, e)}
      >
        <IconGrip size={10} class="grip" />
        {sampleNumber(d().id)}
      </span>
      <span class="swatch mt-[2px]" style={{ background: d().hex }} aria-hidden="true" />
      <div class="min-w-0">
        <input
          class="field"
          value={d().label}
          placeholder={t('sample.namePlaceholder')}
          onInput={(e) => updateSample(d().id, { label: e.currentTarget.value }, false)}
          aria-label={t('sample.nameAria', { n: sampleNumber(d().id) })}
        />
        <ColourReading
          hex={d().hex} hsl={d().hsl}
          copied={() => copied() === d().id} onCopy={() => copy(d().hex, d().id)}
        />
      </div>
      {/* Delete, lock, hide: the order the three decisions arrive in. Removing the point is
          the first thing you reach for when it is wrong; the two softer states only matter once
          the point stays. Resting at 70%: these icons are the only way to reach any of the three
          actions, and one you have to look for is not a control. */}
      <div class="flex flex-col items-end gap-0.5 pt-0.5">
        <button
          class="btn btn-quiet !px-1 !py-0.5"
          title={t('sample.del')}
          onClick={(e) => { e.stopPropagation(); removeSample(d().id); }}
        >
          <IconClose size={13} class="opacity-70" />
        </button>
        <button
          class="btn btn-quiet !px-1 !py-0.5"
          title={d().locked ? t('sample.unlock') : t('sample.lock')}
          onClick={(e) => { e.stopPropagation(); updateSample(d().id, { locked: !d().locked }); }}
        >
          <IconLock size={13} open={!d().locked} class={d().locked ? 'text-clay' : 'opacity-70'} />
        </button>
        <button
          class="btn btn-quiet !px-1 !py-0.5"
          title={d().ignored ? t('sample.include') : t('sample.ignore')}
          onClick={(e) => { e.stopPropagation(); updateSample(d().id, { ignored: !d().ignored }); }}
        >
          <IconEyeOff size={13} class={d().ignored ? 'text-clay' : 'opacity-70'} />
        </button>
      </div>
    </div>
  );
}

export function SamplePanel(props: { onAnalyze: () => void }) {
  const { copied, copy } = useCopy();
  const list = dots;
  let listEl!: HTMLDivElement;

  /*
   * Drag the number to reorder the list. The order is what the numbers are, so this is how
   * you renumber without deleting anything: the row, the dot on the photograph and the chip
   * on the wheel all read the same `sampleNumber`.
   *
   * Nothing reorders while the pointer is still moving — the drag only draws an insertion
   * line, and the list changes on the drop. Re-sorting mid-drag would pull the row out from
   * under the pointer that is dragging it.
   */
  const [drag, setDrag] = createSignal<string | null>(null);
  const [target, setTarget] = createSignal<{ id: string; edge: 'above' | 'below' } | null>(null);

  const reorder: Reorder = {
    start(id, e) {
      setDrag(id);
      // the id travels in the transfer as well, so a drop that reaches us without this
      // component holding state any more still knows what moved
      const dt = e.dataTransfer;
      if (dt) {
        dt.setData('text/plain', id);
        dt.effectAllowed = 'move';
        const row = (e.currentTarget as HTMLElement).closest('[data-sample-id]');
        if (row) dt.setDragImage(row as HTMLElement, 16, 16);
      }
    },
    over(id, e) {
      const from = drag();
      if (!from || from === id) return;
      e.preventDefault(); // without this the browser refuses the drop and nothing happens
      const dt = e.dataTransfer;
      if (dt) dt.dropEffect = 'move';
      const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const edge: 'above' | 'below' = e.clientY < box.top + box.height / 2 ? 'above' : 'below';
      setTarget({ id, edge });
    },
    drop(id, e) {
      e.preventDefault();
      const from = drag() || e.dataTransfer?.getData('text/plain') || null;
      const at = target();
      setDrag(null);
      setTarget(null);
      if (!from || from === id) return;
      moveSample(from, dropIndex(samples(), from, id, at?.edge ?? 'above'));
    },
    end() {
      setDrag(null);
      setTarget(null);
    },
    key(id, e) {
      if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
      e.preventDefault();
      const i = samples().findIndex((s) => s.id === id);
      if (i < 0) return;
      moveSample(id, i + (e.key === 'ArrowDown' ? 1 : -1));
      /*
        Focus follows the sample, not the slot it was sitting in. Rows are keyed by position
        (see the `<Index>` note below), so after one move the element under focus is the
        neighbour that slid into the old slot, and the handler reads that neighbour's id: the
        second Alt+↑ moved the neighbour back and the row appeared to bounce. Re-finding the
        handle by id puts the keyboard back on the row being moved.
      */
      const handle = listEl?.querySelector(`[data-sample-id="${id}"]`)?.querySelector('[data-handle]');
      if (handle instanceof HTMLElement) handle.focus();
    },
    edge: (id) => (target()?.id === id && drag() && drag() !== id ? target()!.edge : ''),
    dragging: (id) => drag() === id,
  };

  /*
   * Picking a dot on the photo should bring its row into view: the list scrolls on its own,
   * so the point you just placed — or just nudged with the arrow keys — can be sitting
   * somewhere off the bottom of the panel. `block: 'nearest'` keeps an already-visible row
   * exactly where it is instead of jerking it to the middle.
   */
  createEffect(on(selected, (id) => {
    if (!id || !listEl) return;
    const row = listEl.querySelector(`[data-sample-id="${id}"]`);
    if (!row) return;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    row.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' });
  }));

  /*
   * How many points to offer is decided by the photo, not by the button label: four if the
   * frame is one idea, eight if it is busy. The button tops the set up rather than resetting
   * it, so hand-placed points stay and a second press — with every good spot already taken
   * — does nothing, which is the correct answer rather than a broken button.
   */
  function suggest() {
    if (!pixelsReady()) return; // the button says so too; a press that silently finds nothing is a broken button
    const taken = samples();
    const fresh = sampler.suggest(sampleSize(), MIN_SAMPLES, SUGGEST_MAX)
      .filter((p) => !taken.some((s) => Math.hypot(s.x - p.u, s.y - p.v) < 0.015));
    addSamples(fresh.map((p) => ({ hex: p.hex, x: p.u, y: p.v })));
  }

  const n = () => samples().length;
  const short = () => n() < MIN_SAMPLES;

  return (
    <aside class="card p-4 flex flex-col gap-3">
      {/*
        The heading, how many points the list holds, and the three actions share one line: they
        are one decision about this list, and a heading on its own line made the buttons look
        like a second section. Baseline alignment keeps the 17px word and the 12px labels on one
        line of text; flex-wrap is the fallback when the column gets narrow. The count rides
        with the title instead of heading the card: it is a reading, not a headline, and
        "4–8 suggested" described a button that already suggests. Below the minimum, the Analyze
        button says so itself.
      */}
      <div class="flex flex-wrap items-baseline gap-x-3 gap-y-2">
        <h3 class="display text-[17px]">{t('sample.title')}
          <span class="ml-2 text-clay tabular-nums">{n()}</span>
        </h3>
        {/*
          Every action says what it is. Three controls in a row where one had a word, one had
          a sparkle and one had nothing at all meant pressing them was a guess — and the two
          destructive ones looked exactly alike.
        */}
        <div class="flex flex-wrap items-center gap-1">
          {/* the suggestion engine reads pixels, so it says when it cannot yet */}
          <button
            class="btn btn-quiet !px-2 !py-1 !gap-1 text-[12px]"
            onClick={suggest}
            disabled={!pixelsReady()}
            classList={{ 'opacity-45 cursor-not-allowed': !pixelsReady() }}
            title={pixelsReady() ? t('sample.suggestTitle') : t('sample.suggestWaiting')}
          >
            <IconSparkle size={13} />{t('sample.suggest')}
          </button>
          <button class="btn btn-quiet !px-2 !py-1 !gap-1 text-[12px]" onClick={undo} title={t('sample.undoTitle')}>
            <IconUndo size={13} />{t('sample.undo')}
          </button>
          <button class="btn btn-quiet !px-2 !py-1 !gap-1 text-[12px]" onClick={() => clearAll()} title={t('sample.clearTitle')}>
            <IconTrash size={13} />{t('sample.clear')}
          </button>
        </div>
      </div>

      {/* how much of the photo each click reads */}
      <div class="flex items-center gap-2">
        <span class="eyebrow" title={t('sample.sizeHint')}>{t('sample.sizeLabel')}</span>
        <select
          class="select-cl font-mono ml-auto"
          value={String(sampleSize())}
          onChange={(e) => setSampleSize(Number(e.currentTarget.value) as SampleSize)}
          title={t('sample.sizeHint')}
          aria-label={t('sample.sizeLabel')}
        >
          <For each={SAMPLE_SIZES}>{(n) => <option value={String(n)}>{n}×{n}</option>}</For>
        </select>
      </div>

      <div ref={listEl} class="flex flex-col gap-2 overflow-y-auto py-1.5 pr-1" style={{ 'max-height': '42vh' }}>
        <Show when={n() === 0}>
          <p class="text-[13px] text-muted italic py-6 text-center">{t('sample.empty')}</p>
        </Show>
        {/*
          `<Index>`, not `<For>`: renaming a sample replaces its object, and `<For>` keys
          rows by object identity — it would rebuild the row and the name field would lose
          focus after one keystroke. Index keys by position, so the field survives typing.
        */}
        <Index each={list()}>
          {(d) => <SampleRow d={d} copied={copied} copy={copy} reorder={reorder} />}
        </Index>
      </div>

      <Show when={n() > 0}>
        <p class="mono-meta border-t border-line pt-2">
          {t('sample.coverage', {
            s: coverage().shadows, m: coverage().midtones, h: coverage().highlights,
          })}
          <Show when={coverage().highlights === 0 || coverage().shadows === 0}>
            <span class="block text-[11px] not-italic text-[#8a6a33] mt-1">
              {coverage().highlights === 0 ? t('sample.noHighlights') : t('sample.noShadows')}
            </span>
          </Show>
        </p>
      </Show>

      <button class="btn btn-primary w-full mt-1" disabled={!canAnalyze()} onClick={props.onAnalyze}>
        {t('sample.analyze')} <IconArrow size={15} />
      </button>
      <Show when={short()}>
        <p class="text-[11.5px] text-muted -mt-1 text-center">{t('sample.more', { n: MIN_SAMPLES - n() })}</p>
      </Show>
    </aside>
  );
}
