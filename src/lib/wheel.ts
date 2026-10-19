/**
 * The wheel's geometry, apart from the wheel.
 *
 * Every number here was arrived at by eye on a Retina screen: the disc edge lined up with
 * the rim ticks, an arrowhead landing on a target's ring rather than in its middle, six
 * labels sitting the same distance from the rim whichever language they are written in.
 * Pulling them out of the component is what makes them checkable by assertion instead.
 *
 * Nothing in this file touches the DOM.
 */

/** the ring inside the SVG box that belongs to the rim labels */
export const RIM = 62;
/** how far a tick sticks out from the disc edge, into the rim */
export const TICK = 6;
/** clear space between the disc edge and the nearest point of a label */
export const LABEL_GAP = 11;
/** half the height of a label's box, used to keep the radial gap even for wide and tall words */
export const LABEL_HALF_H = 7;
/** the dot chips and the ghost targets share one radius, so arrows land on the rim exactly */
export const DOT_R = 15;
export const GHOST_R = 15;

export type Point = { x: number; y: number };

export type Label = { h: number; key: string };

/** The six names on the rim. Everything else about a label is measured, not assumed. */
export const LABELS: readonly Label[] = [
  { h: 0, key: 'hue.red' }, { h: 60, key: 'hue.yellow' }, { h: 120, key: 'hue.green' },
  { h: 180, key: 'hue.cyan' }, { h: 240, key: 'hue.blue' }, { h: 300, key: 'hue.magenta' },
];

/**
 * Hue 0 is due east and the wheel turns counter-clockwise — the direction every hue wheel
 * and every colour picker in the world uses, which is why the negative sign matters: it is
 * the difference between a wheel that matches the disc and one that mirrors it.
 */
export function polar(cx: number, cy: number, hue: number, radius: number): Point {
  const a = (-hue * Math.PI) / 180;
  return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
}

export type LabelGeom = {
  key: string;
  x: number; y: number;
  /** unit vector from the centre through the label: the radius it sits on */
  ux: number; uy: number;
  /** distance from the centre to the label's centre */
  d: number;
  tickA: Point; tickB: Point;
};

/**
 * Place the rim labels so that the gap from the disc edge to the *nearest point of the box*
 * is LABEL_GAP for every one of them.
 *
 * Centring a label on the radius at a fixed distance is what makes the six look uneven: a
 * wide word and a narrow one reach different distances toward the centre along the same
 * radius, and a translated label ("yellow-green" against "黄绿") is wider again. So the box
 * is pushed out by its own projection onto the radius it sits on.
 *
 * `widths` is the measured pixel width of each label in the current font, keyed by message
 * key; the fallback is what a mid-length word measures.
 */
export function labelGeometry(
  cx: number, cy: number, radius: number,
  widths: Record<string, number>, labels: readonly Label[] = LABELS,
): LabelGeom[] {
  return labels.map((l) => {
    const th = (-l.h * Math.PI) / 180;
    const ux = Math.cos(th), uy = Math.sin(th);
    const hw = (widths[l.key] ?? 26) / 2;
    const d = radius + LABEL_GAP + hw * Math.abs(ux) + LABEL_HALF_H * Math.abs(uy);
    return {
      key: l.key,
      tickA: polar(cx, cy, l.h, radius - 1),
      tickB: polar(cx, cy, l.h, radius + TICK),
      x: cx + ux * d, y: cy + uy * d,
      ux, uy, d,
    };
  });
}

/**
 * The analogous window, drawn as a wedge from the centre.
 *
 * The sweep flag is what decides whether the wedge is the 60° window or the 300° that is
 * left over, so it is computed from the angle rather than hardcoded.
 */
export function arcPath(cx: number, cy: number, radius: number, start: number, end: number): string {
  const p1 = polar(cx, cy, start, radius), p2 = polar(cx, cy, end, radius);
  const sweep = Math.abs(end - start) > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${radius} ${radius} 0 ${sweep} 0 ${p2.x} ${p2.y} Z`;
}

/**
 * An arrow that starts on the source chip's edge and stops on the target's rim.
 *
 * Centre-to-centre is what makes a guide look like it misses: the head lands in the middle
 * of the target and hides it. Both kinds of move — the one the app suggests and the one
 * placed by hand — go through here, so they are drawn identically and cannot drift apart.
 */
export function connector(from: Point, to: Point, startPad: number, endPad: number) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  const ux = len ? dx / len : 0, uy = len ? dy / len : 0;
  return {
    ax: from.x + ux * startPad, ay: from.y + uy * startPad,
    bx: to.x - ux * endPad, by: to.y - uy * endPad,
    // two chips almost on top of each other get no arrow at all: a line of negative length
    // is drawn backwards, and an arrow pointing the wrong way is worse than none
    visible: len > startPad + endPad,
  };
}
