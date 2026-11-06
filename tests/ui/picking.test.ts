import { describe, expect, it } from 'vitest';
import { pickAt, sameTypeOnScreen, unitsInRect, type ScreenUnit } from '../../src/ui/input/picking';

const unit = (
  id: number,
  owner: 0 | 1,
  sx: number,
  sy: number,
  type: ScreenUnit['type'] = 'militia',
): ScreenUnit => ({
  id,
  owner,
  type,
  sx,
  sy,
  fx: sx,
  fy: sy + 10,
  pickRadius: 15,
});

describe('picking', () => {
  it('picks the nearest unit within its radius', () => {
    const units = [unit(1, 0, 100, 100), unit(2, 0, 120, 100)];
    expect(pickAt(units, 112, 100, 0)?.id).toBe(2);
    expect(pickAt(units, 300, 300, 0)).toBeNull();
  });

  it('prefers own units over overlapping enemy units', () => {
    const units = [unit(1, 1, 100, 100), unit(2, 0, 110, 100)];
    expect(pickAt(units, 100, 100, 0)?.id).toBe(2);
    expect(pickAt([unit(1, 1, 100, 100)], 100, 100, 0)?.id).toBe(1); // enemy alone can still be inspected
  });

  it('box-selects own units by their feet, in any drag direction', () => {
    const units = [unit(1, 0, 50, 50), unit(2, 0, 150, 150), unit(3, 1, 60, 60)];
    expect(unitsInRect(units, 0, 0, 100, 100, 0)).toEqual([1]);
    expect(unitsInRect(units, 200, 200, 0, 0, 0)).toEqual([1, 2]);
  });

  it('selects all own units of a type on screen', () => {
    const units = [
      unit(1, 0, 50, 50),
      unit(2, 0, 60, 60, 'archer'),
      unit(3, 0, 5000, 50),
      unit(4, 0, 70, 80),
    ];
    expect(sameTypeOnScreen(units, 'militia', 0, 800, 600)).toEqual([1, 4]);
  });
});
