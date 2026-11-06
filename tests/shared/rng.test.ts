import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/shared/rng';
import { secondsToTicks, TICK_RATE } from '../../src/shared/constants';

describe('Rng', () => {
  it('is deterministic for the same seed', () => {
    const a = new Rng(1234);
    const b = new Rng(1234);
    const seqA = Array.from({ length: 100 }, () => a.next());
    const seqB = Array.from({ length: 100 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('differs for different seeds', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    expect(a.next()).not.toEqual(b.next());
  });

  it('stays in [0, 1) and int() respects inclusive bounds', () => {
    const rng = new Rng(42);
    const seen = new Set<number>();
    for (let i = 0; i < 10_000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      const n = rng.int(3, 6);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(6);
      seen.add(n);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });

  it('can save and restore its state (replays)', () => {
    const rng = new Rng(99);
    rng.next();
    const saved = rng.getState();
    const expected = [rng.next(), rng.next(), rng.next()];
    rng.setState(saved);
    expect([rng.next(), rng.next(), rng.next()]).toEqual(expected);
  });
});

describe('ticks', () => {
  it('converts seconds to ticks at the fixed tick rate', () => {
    expect(TICK_RATE).toBe(20);
    expect(secondsToTicks(1)).toBe(20);
    expect(secondsToTicks(1.5)).toBe(30);
    expect(secondsToTicks(0.07)).toBe(1);
    expect(secondsToTicks(-3)).toBe(0);
  });
});
