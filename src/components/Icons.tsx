import { glyphAngles } from '../lib/harmonies.ts';
import type { HarmonyType } from '../lib/harmonies.ts';

type P = { class?: string; size?: number };

const Svg = (p: P & { children: any }) => (
  <svg viewBox="0 0 24 24" width={p.size ?? 16} height={p.size ?? 16} fill="none"
    stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
    class={p.class} aria-hidden="true">{p.children}</svg>
);

export const IconArrow = (p: P) => <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>;
export const IconBack = (p: P) => <Svg {...p}><path d="M19 12H5M11 18l-6-6 6-6" /></Svg>;
export const IconCopy = (p: P) => <Svg {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a1 1 0 0 1 1-1h9" /></Svg>;
export const IconClose = (p: P) => <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>;
export const IconPlus = (p: P) => <Svg {...p} stroke-width="1.2"><path d="M12 5v14M5 12h14" /></Svg>;
export const IconHelp = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M9.6 9.2a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .9-1 1.6v.4" /><circle cx="12" cy="17" r=".6" fill="currentColor" /></Svg>;
export const IconUndo = (p: P) => <Svg {...p}><path d="M9 14L4 9l5-5" /><path d="M4 9h9a6 6 0 0 1 0 12H8" /></Svg>;
export const IconSparkle = (p: P) => <Svg {...p}><path d="M12 4l1.8 4.6L18 10l-4.2 1.4L12 16l-1.8-4.6L6 10l4.2-1.4z" /></Svg>;
export const IconGrip = (p: P) => (
  <Svg {...p} stroke-width="1.8">
    <path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" />
  </Svg>
);
export const IconTrash = (p: P) => (
  <Svg {...p}>
    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
    <path d="M10 11v6M14 11v6" />
  </Svg>
);

export const IconLock = (p: P & { open?: boolean }) => (
  <Svg {...p}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    {p.open ? <path d="M8 11V8a4 4 0 0 1 7.5-2" /> : <path d="M8 11V8a4 4 0 0 1 8 0v3" />}
  </Svg>
);

export const IconEyeOff = (p: P) => (
  <Svg {...p}><path d="M3 3l18 18" /><path d="M10.6 6.2A9.8 9.8 0 0 1 12 6c5 0 9 6 9 6a17 17 0 0 1-2.5 3.2M6.3 8.3A16.8 16.8 0 0 0 3 12s4 6 9 6a9.4 9.4 0 0 0 3.2-.5" /></Svg>
);

export function HarmonyGlyph(p: P & { type: HarmonyType }) {
  const angles = glyphAngles(p.type);
  const R = 8;
  const pt = (a: number) => ({ x: 12 + R * Math.cos((-a * Math.PI) / 180), y: 12 + R * Math.sin((-a * Math.PI) / 180) });
  return (
    <svg viewBox="0 0 24 24" width={p.size ?? 16} height={p.size ?? 16} class={p.class} aria-hidden="true">
      <circle cx="12" cy="12" r={R} fill="none" stroke="currentColor" stroke-width="1" opacity=".38"
        stroke-dasharray={p.type === 'custom' ? '2 2' : undefined} />
      {angles.map((a) => {
        const c = pt(a);
        return <circle cx={c.x} cy={c.y} r="2.1" fill="currentColor" />;
      })}
    </svg>
  );
}
