import { describe, expect, test } from 'vitest';
import { measureSeparation } from '../src/lib/separation.ts';

/**
 * These numbers come from the calibration run recorded in src/lib/separation.ts: the ceilings
 * were chosen so that the two readings stay independent on real frames. The tests below are that
 * claim, kept honest — if somebody retunes the ceilings, one of these cases moves.
 */
describe('separation: the axis harmony does not measure', () => {
  test('one colour cannot be separated from itself', () => {
    expect(measureSeparation(['#4474AA'])).toBeNull();
    expect(measureSeparation([])).toBeNull();
  });

  test('a grey frame separates on neither axis', () => {
    const s = measureSeparation(Array(8).fill('#808080'))!;
    expect(s.warmCool).toBe(0);
    expect(s.lightness).toBe(0);
  });

  test('teal against orange is warm-cool separation, not lightness contrast', () => {
    const s = measureSeparation(['#0FB3B3', '#FF7A29'])!;
    expect(s.warmCool).toBeGreaterThan(70);
    expect(s.lightness).toBeLessThan(10);
    expect(s.warmest).toBe('#FF7A29');
    expect(s.coolest).toBe('#0FB3B3');
  });

  test('black against white is the opposite case, so the readings stay independent', () => {
    const s = measureSeparation(['#000000', '#FFFFFF'])!;
    expect(s.lightness).toBe(100);
    expect(s.warmCool).toBe(0);
    expect(s.lightest).toBe('#FFFFFF');
    expect(s.darkest).toBe('#000000');
  });

  test('one hue spread across lightnesses reads as light-dark, not warm-cool', () => {
    const s = measureSeparation(['#26364A', '#3E5C7E', '#6E8FB0', '#A9C2D8', '#DCE7F0'])!;
    expect(s.lightness).toBeGreaterThan(70);
    expect(s.warmCool).toBeLessThan(25);
  });

  test('the order of the list does not move the numbers', () => {
    const hexes = ['#AF5748', '#423129', '#4474AA', '#E1E6E9', '#BEB2A9'];
    expect(measureSeparation(hexes)).toEqual(measureSeparation([...hexes].reverse()));
  });

  test('a maximally separated set still reads inside 0-100', () => {
    const s = measureSeparation(['#E03131', '#2F6BE4', '#F2C230', '#000000', '#FFFFFF'])!;
    expect(s.warmCool).toBeLessThanOrEqual(100);
    expect(s.lightness).toBeLessThanOrEqual(100);
  });
});
