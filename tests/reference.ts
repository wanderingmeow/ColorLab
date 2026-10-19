/**
 * Regression data — the seven samples and the expected output read off the original tool's
 * screenshots and walkthrough. Test-only: the app no longer ships this, and there is no
 * "load reference data" button.
 *
 * `label` is the English source text the original panel showed; `name` is a hue key from
 * `hueName()`.
 */
export type FixtureSample = {
  id: string; label: string; hex: string; hue: number; s: number; l: number; name: string;
};

export const REFERENCE: FixtureSample[] = [
  { id: 'c1', label: 'flowers roses', hex: '#777578', hue: 280, s: 1, l: 46, name: 'violet' },
  { id: 'c2', label: 'trees upper part', hex: '#192113', hue: 94, s: 27, l: 10, name: 'yellow-green' },
  { id: 'c3', label: 'grass', hex: '#364224', hue: 84, s: 29, l: 20, name: 'yellow-green' },
  { id: 'c4', label: 'tower in the light', hex: '#F7D4AF', hue: 31, s: 82, l: 83, name: 'orange' },
  { id: 'c5', label: 'tower in the shadow', hex: '#90908D', hue: 60, s: 1, l: 56, name: 'yellow' },
  { id: 'c6', label: 'wall church', hex: '#AFBBC5', hue: 207, s: 16, l: 73, name: 'sky-blue' },
  { id: 'c7', label: 'roof', hex: '#6C5D50', hue: 28, s: 15, l: 37, name: 'red-orange' },
];

/** What the original tool reports for this set of samples. */
export const REFERENCE_EXPECTED = {
  detected: 'split-complementary' as const,
  builtAround: ['blue', 'orange', 'yellow-green'],
  /** Split-Complementary */
  split: {
    aligned: ['c2', 'c3', 'c4', 'c7'],
    shiftToward: { c1: 'blue', c5: 'orange', c6: 'blue' } as Record<string, string>,
    targetHue: { c1: 240, c5: 30 } as Record<string, number>,
    targetHex: { c1: '#747476', c5: '#908F8E' } as Record<string, string>,
  },
  /** Analogous (the second screenshot: "Big shift toward yellow-green") */
  analogous: {
    aligned: ['c2', 'c3', 'c4', 'c5', 'c7'],
    shiftToward: { c6: 'yellow-green', c1: 'orange' } as Record<string, string>,
    bigShift: ['c6'],
    targetHex: { c6: '#BAC5AF' } as Record<string, string>,
  },
};
