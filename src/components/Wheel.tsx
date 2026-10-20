import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { chromaRatio, retarget, retargetRelative, wheelRgb } from '../lib/color.ts';
import type { Fit, Suggestion } from '../lib/harmonies.ts';
import { ANALOGOUS_WINDOW, NEUTRAL_FLOOR } from '../lib/harmonies.ts';
import { harmonyLabel, hueLabel, locale, t } from '../i18n/index.ts';
import { activeFit, activeType, customReadout } from '../lib/analysis.ts';
import {
  DOT_R, GHOST_R, LABELS, LABEL_GAP, RIM,
  arcPath, connector, labelGeometry, polar,
} from '../lib/wheel.ts';
import type { LabelGeom, Point } from '../lib/wheel.ts';
import {
  clearCustomHue, customHue, dots, retargetMode, selected, setCustomHue, setSelected,
  tab, sampleNumber,
} from '../lib/store.ts';

/** Rim labels are measured in this font, so the width that is measured is the width drawn. */
const LABEL_FONT = '500 13.5px "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif';

/** ?ruler=1 — draws the geometry the code believes in, over what the browser paints */
const RULER = new URLSearchParams(window.location.search).has('ruler');

/** internal resolution of the hue field; the renderer resamples it, so it is built once */
const RASTER = 768;
let discPng = '';

/**
 * Square hue field whose inscribed circle is the disc: white at the centre, full hue at
 * the rim (HSL S = r, L = 100 − 50r — the same model the reference tool's wheel uses).
 */
function buildDisc(): string {
  if (discPng) return discPng;
  const res = RASTER;
  const c2 = document.createElement('canvas');
  c2.width = res; c2.height = res;
  const cx = c2.getContext('2d');
  if (!cx) return '';
  const img = cx.createImageData(res, res);
  const data = img.data;
  const cc = res / 2;
  for (let y = 0; y < res; y++) {
    const dy = y - cc;
    for (let x = 0; x < res; x++) {
      const dx = x - cc;
      const rad = Math.hypot(dx, dy);
      // anti-alias the outermost half-pixel so the field itself has no stair-stepping
      const t0 = Math.min(1, rad / cc);
      const hue = (Math.atan2(-dy, dx) * 180 / Math.PI + 360) % 360;
      // the same two lines the rest of the app uses: the disc you look at is the model the
      // dots are plotted on, not a second implementation of it that happens to look alike
      const rgb = wheelRgb(hue, t0);
      const i = (y * res + x) * 4;
      data[i] = rgb.r; data[i + 1] = rgb.g; data[i + 2] = rgb.b;
      data[i + 3] = rad > cc ? 0 : rad > cc - 1 ? (cc - rad) * 255 : 255;
    }
  }
  cx.putImageData(img, 0, 0);
  discPng = c2.toDataURL('image/png');
  return discPng;
}

const START_PAD = DOT_R + 3;
const END_PAD = GHOST_R + 1;   // the tip lands on the ring, not on the centre

type Target = {
  id: string;
  to: Point;
  hex: string;
  ax: number; ay: number; bx: number; by: number;
  visible: boolean;
};

/**
 * A target on the rim, the arrow leading to it, and a way to take it back.
 *
 * Hand-placed targets use this so they look exactly like the moves the app proposes —
 * which is the point: they are the same kind of thing, just drawn by the user instead.
 */
function TargetMark(props: { t: Target; onGrab: (e: PointerEvent) => void; onDelete: () => void }) {
  const x = () => props.t.to.x + GHOST_R + 3;
  const y = () => props.t.to.y - GHOST_R - 3;
  return (
    <g>
      <Show when={props.t.visible}>
        <line x1={props.t.ax} y1={props.t.ay} x2={props.t.bx} y2={props.t.by}
          stroke="#3a3128" stroke-width="1.6" marker-end="url(#ah)" opacity=".9" />
      </Show>
      <g filter="url(#chip-shadow)">
        <circle cx={props.t.to.x} cy={props.t.to.y} r={GHOST_R + 3.5} fill="none"
          stroke="#2a231c" stroke-width="1.2" stroke-dasharray="3 3" opacity=".75" />
        <circle
          cx={props.t.to.x} cy={props.t.to.y} r={GHOST_R} fill={props.t.hex}
          stroke="#fffdf9" stroke-width="2" class="cursor-grab active:cursor-grabbing"
          style={{ 'pointer-events': 'all' }}
          onPointerDown={props.onGrab}
        />
      </g>
      <g
        class="cursor-pointer" style={{ 'pointer-events': 'all' }}
        role="button" tabindex={-1} aria-label={t('wheel.clearMoveAria')}
        onPointerDown={(e) => { e.stopPropagation(); props.onDelete(); }}
      >
        <circle cx={x()} cy={y()} r="7.5" fill="#fffdf9" stroke="#2a231c" stroke-width="1" />
        <path d={`M ${x() - 4.5} ${y() - 4.5} l 9 9 M ${x() + 4.5} ${y() - 4.5} l -9 9`}
          stroke="#2a231c" stroke-width="1.5" stroke-linecap="round" />
      </g>
    </g>
  );
}

/** what `dots()` hands back: a sample plus its HSL and plotting hue */
type Dot = ReturnType<typeof dots>[number];

/** One centre, one radius, one box: the wheel's coordinate system, handed over as a whole. */
type Field = {
  c: () => number;
  R: () => number;
  size: () => number;
  disc: () => string;
  mode: () => string;
  arc: () => string;
  labels: () => LabelGeom[];
  skeleton: () => { x: number; y: number }[];
};

/**
 * The hue field: the painted disc, the rings that explain it, the six names on the rim, and
 * the arms of the harmony being read.
 *
 * Every piece is drawn in the SVG's own user space from the same centre and radius the dots
 * use. That is what used to be wrong here: an <img> of the disc living in a second
 * coordinate system drifts by a pixel on a Retina screen, and a rim label that drifts names
 * the wrong hue.
 */
function WheelField(props: Field) {
  const c = props.c, R = props.R;
  return (
    <>
      {/* the hue field lives in this same user space as the dots: it cannot drift */}
      <Show when={props.disc()}>
        <image href={props.disc()} x={c() - R()} y={c() - R()} width={R() * 2} height={R() * 2}
          clip-path="url(#disc-clip)" preserveAspectRatio="xMidYMid slice" />
      </Show>
      <circle cx={c()} cy={c()} r={R()} fill="none" stroke="rgba(27,23,20,.16)" stroke-width="1" />

      {/* lightness rings */}
      <circle cx={c()} cy={c()} r={R() / 3} fill="none" stroke="rgba(0,0,0,.07)" stroke-width="1" />
      <circle cx={c()} cy={c()} r={(R() * 2) / 3} fill="none" stroke="rgba(0,0,0,.07)" stroke-width="1" />
      <Show when={props.mode() === 'natural'}>
        <circle cx={c()} cy={c()} r={R() * NEUTRAL_FLOOR} fill="none"
          stroke="rgba(30,26,22,.34)" stroke-width="1" stroke-dasharray="4 4" />
      </Show>

      <Show when={props.arc()}>
        {(a) => <path d={a()} fill="rgba(255,255,255,.42)" stroke="rgba(30,26,22,.25)" stroke-dasharray="3 3" />}
      </Show>

      <Show when={RULER}>
        {/* the circle the ticks are placed against: if the disc edge does not sit on
            this line, the disc and the overlay are not in the same space */}
        <circle cx={c()} cy={c()} r={R()} fill="none" stroke="#ff00c8" stroke-width="1.5" stroke-dasharray="6 4" />
        <circle cx={c()} cy={c()} r={R() + LABEL_GAP} fill="none" stroke="#00a6ff" stroke-width="1" stroke-dasharray="3 3" />
        <line x1={c() - 14} y1={c()} x2={c() + 14} y2={c()} stroke="#ff00c8" stroke-width="1.5" />
        <line x1={c()} y1={c() - 14} x2={c()} y2={c() + 14} stroke="#ff00c8" stroke-width="1.5" />
        <For each={props.labels()}>
          {(g) => (
            <g>
              <line x1={c()} y1={c()} x2={g.x} y2={g.y} stroke="#ff00c8"
                stroke-width="0.75" stroke-dasharray="2 3" opacity=".8" />
              <text x={c() + g.ux * (g.d + 16)} y={c() + g.uy * (g.d + 16)} text-anchor="middle"
                dominant-baseline="middle" font-size="9" fill="#ff00c8" font-family="monospace">
                {`${Math.round(g.d - R())}px`}
              </text>
            </g>
          )}
        </For>
        <text x={6} y={12} font-size="10" fill="#ff00c8" font-family="monospace">
          {`box ${props.size()} · R ${Math.round(R())} · ticks at ${Math.round(R() - 1)}`}
        </text>
      </Show>

      <For each={props.labels()}>
        {(g) => (
          <g>
            <line x1={g.tickA.x} y1={g.tickA.y} x2={g.tickB.x} y2={g.tickB.y}
              stroke="#b6a694" stroke-width="1" />
            <text x={g.x} y={g.y} text-anchor="middle" dominant-baseline="middle"
              font-size="13.5" fill="#4a4239" font-weight="500" letter-spacing="0.01em"
              paint-order="stroke" stroke="#fffdfa" stroke-width="3.5" stroke-linejoin="round"
              font-family="var(--font-display)">{t(g.key)}</text>
          </g>
        )}
      </For>

      <For each={props.skeleton()}>
        {(p) => <circle cx={p.x} cy={p.y} r="4.5" fill="none" stroke="rgba(30,26,22,.4)"
          stroke-width="1.2" stroke-dasharray="2 2" />}
      </For>
    </>
  );
}

type SuggestedTarget = {
  id: string; to: Point; s: Suggestion; hue: number;
  ax: number; ay: number; bx: number; by: number; visible: boolean;
};

/**
 * The moves the app is proposing.
 *
 * Two passes: every arrow first, then every target chip. One pass would put each arrow on
 * top of the neighbouring chips; two passes let an arrow start from under its own chip and
 * still land on a rim painted with the colour it points at.
 */
function SuggestedTargets(props: { targets: () => SuggestedTarget[] }) {
  return (
    <>
      <For each={props.targets()}>
        {(tg) => (
          <Show when={tg.visible}>
            <line x1={tg.ax} y1={tg.ay} x2={tg.bx} y2={tg.by}
              stroke="#3a3128" stroke-width="1.6" marker-end="url(#ah)" opacity=".9" />
          </Show>
        )}
      </For>
      <For each={props.targets()}>
        {(tg) => (
          <g filter="url(#chip-shadow)">
            <circle cx={tg.to.x} cy={tg.to.y} r={GHOST_R + 3.5} fill="none"
              stroke="#2a231c" stroke-width="1.2" stroke-dasharray="3 3" opacity=".75" />
            <circle cx={tg.to.x} cy={tg.to.y} r={GHOST_R} fill={tg.s.targetHex}
              stroke="#fffdf9" stroke-width="2" />
          </g>
        )}
      </For>
    </>
  );
}

/**
 * One sample on the wheel.
 *
 * The number in the middle is the number in the list — `sampleNumber`, never the internal
 * id — because a wheel and a panel that disagree about which dot is which are worse than no
 * wheel at all.
 */
function DotChip(props: {
  d: Dot;
  p: { x: number; y: number };
  custom: () => boolean;
  onDown: (e: PointerEvent, id: string) => void;
}) {
  const d = props.d;
  return (
    <g
      class={props.custom() ? 'cursor-grab' : 'cursor-default'}
      onPointerDown={(e) => props.onDown(e, d.id)}
      role="button"
      tabindex={0}
      aria-label={t(
        customHue()[d.id] === undefined ? 'wheel.dotAria' : 'wheel.dotMovedAria',
        { n: sampleNumber(d.id), hue: hueLabel(d.hue), h: Math.round(d.hue), to: Math.round(customHue()[d.id] ?? d.hue) },
      )}
      onKeyDown={(e) => {
        if (!props.custom()) return;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          // nudge from the target already placed, not from the dot: the second press has to
          // keep going in the same direction, not snap back to the true hue
          const base = customHue()[d.id] ?? d.hue;
          const h = (base + (e.key === 'ArrowRight' ? 2 : -2) + 360) % 360;
          setCustomHue((prev) => ({ ...prev, [d.id]: Math.round(h) }));
        }
        if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault();
          clearCustomHue(d.id);
        }
      }}
    >
      <circle cx={props.p.x} cy={props.p.y} r={DOT_R} fill={d.hex} stroke="#fffdf9" stroke-width="2.5"
        filter="url(#chip-shadow)" opacity={d.ignored ? 0.4 : 1} />
      <Show when={d.locked}>
        <circle cx={props.p.x + 12} cy={props.p.y - 12} r="4" fill="#171412" stroke="#fffdf9" stroke-width="1.2" />
      </Show>
      <text x={props.p.x} y={props.p.y} text-anchor="middle" dominant-baseline="central"
        font-size="12" font-weight="500" fill="#fff" style={{ 'text-shadow': '0 1px 2px rgba(0,0,0,.6)' }}>
        {sampleNumber(d.id)}
      </text>
    </g>
  );
}

export function Wheel() {
  let wrap!: HTMLDivElement;
  let svg!: SVGSVGElement;
  const [size, setSize] = createSignal(520);
  const [disc, setDisc] = createSignal('');
  const [labelW, setLabelW] = createSignal<Record<string, number>>({});

  onMount(() => setDisc(buildDisc()));

  // measured widths, so every label can be pushed out by its own projection and keep the
  // same gap to the rim — an estimate would leave the long names (magenta) closer than the short
  if (RULER) {
    createEffect(() => {
      const s = size();
      queueMicrotask(() => {
        const box = svg?.getBoundingClientRect();
        const img = svg?.querySelector('image')?.getBoundingClientRect();
        const dot = svg?.querySelector('circle[r]');
        console.warn('[ruler]', {
          size: s, R: Math.round(R()),
          svgBox: box && { x: +box.x.toFixed(1), y: +box.y.toFixed(1), w: +box.width.toFixed(1), h: +box.height.toFixed(1) },
          imageBox: img && { x: +img.x.toFixed(1), y: +img.y.toFixed(1), w: +img.width.toFixed(1), h: +img.height.toFixed(1) },
          viewBox: svg?.getAttribute('viewBox'),
          firstCircleR: dot?.getAttribute('r'),
        });
      });
    });
  }

  createEffect(() => {
    locale();
    const cx = document.createElement('canvas').getContext('2d');
    if (!cx) return;
    cx.font = LABEL_FONT;
    setLabelW(Object.fromEntries(LABELS.map((l) => [l.key, cx.measureText(t(l.key)).width])));
  });

  let ro: ResizeObserver | undefined;
  onMount(() => {
    ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 520;
      setSize(Math.max(300, Math.min(600, Math.floor(w))));
    });
    ro.observe(wrap);
  });
  onCleanup(() => ro?.disconnect());

  const c = () => size() / 2;
  const R = () => size() / 2 - RIM;   // the RIM ring is where the ticks and labels live
  const mode = tab;
  const fit = activeFit;
  const custom = createMemo(() => activeType() === 'custom');

  const pt = (hue: number, radius: number) => polar(c(), c(), hue, radius);

  /**
   * Label placement. This MUST be a memo read through <For>: LABELS is a constant array, so
   * a plain <For each={LABELS}> callback runs once and its `x`/`y` would be frozen at the
   * first measured width — the labels would stop following resizes and language switches.
   */
  const labelGeom = createMemo(() => labelGeometry(c(), c(), R(), labelW()));

  const radiusFor = (d: { hsl: { s: number } }) =>
    mode() === 'natural' ? (d.hsl.s / 100) * R() : R();

  /**
   * Custom mode: the targets placed by hand, drawn as the moves they are.
   *
   * The dot itself stays exactly where its colour is — a chip dragged to a hue it does not
   * have is the canvas describing a photograph that was never taken. What moves is a target
   * beside it, painted with the colour the dot would take, joined by the same arrow a
   * suggested move uses. From the target the user can read the intent; from the dot, the fact.
   */
  const ghosts = createMemo(() => {
    if (!custom()) return [];
    const ch = customHue();
    const mode = retargetMode();
    return dots().flatMap((d) => {
      const h = ch[d.id];
      if (h === undefined) return [];
      const to = pt(h, R());
      return [{
        id: d.id, d, to, hue: h,
        hex: mode === 'relative' ? retargetRelative(d.hex, h) : retarget(d.hex, h),
        ...connector(pt(d.hue, radiusFor(d)), to, START_PAD, END_PAD),
      }];
    });
  });

  const positions = createMemo(() =>
    dots().map((d) => ({ d, p: pt(d.hue, radiusFor(d)) })));

  /**
   * Ghost targets + the arrow that points at them. The arrow starts on the source dot's
   * edge and its tip stops on the ghost's edge — never centre to centre, or the head
   * hides under the chip and short moves look like nothing at all.
   */
  const targets = createMemo(() => {
    const f: Fit | null = fit();
    if (!f || mode() !== 'guide') return [];
    const byId = new Map(f.suggestions.map((s) => [s.id, s]));
    return dots().flatMap((d) => {
      const s = byId.get(d.id);
      if (!s || s.kind !== 'shift' || s.targetHue === undefined) return [];
      const from = pt(d.hue, radiusFor(d));
      const to = pt(s.targetHue, R());
      const link = connector(from, to, START_PAD, END_PAD);
      return [{ id: d.id, to, s, hue: s.targetHue, ...link }];
    });
  });

  /** what has to sit above every other chip: the selected dot and the arrow it is following */
  const selDot = createMemo(() => positions().find((q) => q.d.id === selected()));
  const selArrow = createMemo(() => {
    const id = selected();
    return id ? targets().find((tg) => tg.id === id && tg.visible) : undefined;
  });
  const selGhost = createMemo(() => {
    const id = selected();
    return id ? ghosts().find((g) => g.d.id === id) : undefined;
  });

  const arc = createMemo(() => {
    const f = fit();
    if (!f || activeType() !== 'analogous' || mode() !== 'guide') return '';
    const [a, b] = f.window ?? [f.anchor, f.anchor + ANALOGOUS_WINDOW];
    return arcPath(c(), c(), R(), a, b);
  });

  const skeleton = createMemo(() => {
    const f = fit();
    if (!f || mode() !== 'guide' || activeType() === 'analogous') return [];
    return f.slots.map((h) => pt(h, R()));
  });

  /* ------------------------------------------------------------ custom drag */
  let dragId: string | null = null;
  function hueFromEvent(e: PointerEvent) {
    const r = svg.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    return (Math.atan2(-dy, dx) * 180 / Math.PI + 360) % 360;
  }
  function onDown(e: PointerEvent, id: string) {
    setSelected(id);
    if (!custom()) return;
    dragId = id;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }
  function onMove(e: PointerEvent) {
    if (!dragId) return;
    const h = Math.round(hueFromEvent(e));
    const id = dragId;
    setCustomHue((prev) => ({ ...prev, [id]: h }));
  }
  function onUp() { dragId = null; }

  const readout = createMemo(() => {
    const sel = positions().find((p) => p.d.id === selected());
    if (sel) {
      const d = sel.d;
      const cr = chromaRatio(d.hex);
      const to = customHue()[d.id];
      // the reading is the colour; the target is stated next to it, never instead of it
      const move = to === undefined ? '' : t('wheel.movesTo', { to: Math.round(to), hex: retargetRelative(d.hex, to) });
      return `${d.label || `#${sampleNumber(d.id)}`} · ${d.hex} · ${hueLabel(d.hue)} · H ${Math.round(d.hsl.h)}° S ${Math.round(d.hsl.s)}% L ${Math.round(d.hsl.l)}%${cr < NEUTRAL_FLOOR ? t('wheel.nearNeutral') : ''}${move}`;
    }
    return '';
  });

  return (
    <div ref={wrap} class="w-full max-w-[600px] mx-auto">
      <div class="relative" style={{ width: `${size()}px`, height: `${size()}px`, margin: '0 auto' }}>
        <svg
          ref={svg}
          class="absolute inset-0 no-select"
          width={size()} height={size()} viewBox={`0 0 ${size()} ${size()}`}
          onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        >
          <defs>
            <clipPath id="disc-clip"><circle cx={c()} cy={c()} r={R()} /></clipPath>
            <marker id="ah" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6.5" markerHeight="6.5"
              orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill="#3a3128" />
            </marker>
            <filter id="chip-shadow" x="-60%" y="-60%" width="220%" height="220%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="2.2" flood-color="#1b1714" flood-opacity="0.45" />
            </filter>
          </defs>

          <WheelField c={c} R={R} size={size} disc={disc} mode={mode}
                   arc={arc} labels={labelGeom} skeleton={skeleton} />

          <SuggestedTargets targets={targets} />

          <For each={positions()}>
            {({ d, p }) => <DotChip d={d} p={p} custom={custom} onDown={onDown} />}
          </For>

          {/* hand-placed targets, drawn above the chips so their ✕ stays reachable */}
          <For each={ghosts()}>
            {(g) => (
              <TargetMark
                t={g}
                onGrab={(e) => { e.stopPropagation(); onDown(e, g.d.id); }}
                onDelete={() => clearCustomHue(g.d.id)}
              />
            )}
          </For>

          {/*
            SVG paints in document order and has no z-index, so a selected chip sitting
            between two neighbours got covered by them — ring, number and its arrow all hid
            behind someone else's colour. Moving the real node to the end would drop the
            pointer capture of a drag in progress, so the selected dot's stack is painted a
            second time on top: same geometry, invisible to the pointer, the original keeps
            receiving events. Order inside the copy repeats the base layering, so the arrow
            head still tucks under its own target instead of lying on top of it.
          */}
          <Show when={selDot()}>
            {(q) => {
              const d = () => q().d;
              return (
                <g pointer-events="none" aria-hidden="true">
                  <Show when={selArrow()}>
                    {(a) => (
                      <g>
                        <line x1={a().ax} y1={a().ay} x2={a().bx} y2={a().by}
                          stroke="#3a3128" stroke-width="1.6" marker-end="url(#ah)" opacity=".9" />
                        <circle cx={a().to.x} cy={a().to.y} r={GHOST_R + 3.5} fill="none"
                          stroke="#2a231c" stroke-width="1.2" stroke-dasharray="3 3" opacity=".75" />
                        <circle cx={a().to.x} cy={a().to.y} r={GHOST_R} fill={a().s.targetHex}
                          stroke="#fffdf9" stroke-width="2" />
                      </g>
                    )}
                  </Show>
                  <Show when={selGhost()}>{(g) => (
                    <TargetMark
                      t={g()}
                      onGrab={(e) => { e.stopPropagation(); onDown(e, g().d.id); }}
                      onDelete={() => clearCustomHue(g().d.id)}
                    />
                  )}</Show>
                  <circle cx={q().p.x} cy={q().p.y} r={DOT_R} fill={d().hex} stroke="#fffdf9"
                    stroke-width="2.5" filter="url(#chip-shadow)" opacity={d().ignored ? 0.4 : 1} />
                  <Show when={d().locked}>
                    <circle cx={q().p.x + 12} cy={q().p.y - 12} r="4" fill="#171412" stroke="#fffdf9" stroke-width="1.2" />
                  </Show>
                  <text x={q().p.x} y={q().p.y} text-anchor="middle" dominant-baseline="central"
                    font-size="12" font-weight="500" fill="#fff" style={{ 'text-shadow': '0 1px 2px rgba(0,0,0,.6)' }}>
                    {sampleNumber(d().id)}
                  </text>
                  {/* The selection ring sits on the dot's own white ring, not outside it:
                      r = dot radius + half of the white stroke + half of this stroke. A ring
                      with a gap around a dot reads as an empty circle with the disc showing
                      through, the same mistake the dots on the photo used to make. */}
                  <circle cx={q().p.x} cy={q().p.y} r={DOT_R + 2.5 / 2 + 1.6 / 2} fill="none"
                    stroke="#b0562f" stroke-width="1.6" />
                </g>
              );
            }}
          </Show>
        </svg>
      </div>

      <div class="mt-3 min-h-[18px] text-center">
        <Show when={readout()} fallback={
          <span class="note text-[13px]">
            {mode() === 'natural' ? t('wheel.captionNatural')
              : mode() === 'pure' ? t('wheel.captionPure')
              : custom()
                ? t('wheel.captionCustom', { type: customReadout() ? harmonyLabel(customReadout()!.type) : '—', score: customReadout()?.score ?? 0 })
                : t('wheel.captionGuide')}
          </span>
        }>
          <span class="mono-meta">{readout()}</span>
        </Show>
      </div>
    </div>
  );
}
