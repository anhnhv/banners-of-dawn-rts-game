import { describe, expect, it } from 'vitest';
import { FixedStepClock } from '../../src/host';

describe('FixedStepClock', () => {
  it('produces 20 ticks per second of real time at 1x speed', () => {
    const clock = new FixedStepClock();
    let ticks = 0;
    for (let i = 0; i < 80; i++) ticks += clock.advance(12.5).steps; // 80 frames × 12.5 ms = 1 s
    expect(ticks).toBe(20);
  });

  it('scales with game speed', () => {
    const clock = new FixedStepClock(100);
    expect(clock.advance(1000, 2).steps).toBe(40);
  });

  it('keeps the remainder as interpolation alpha', () => {
    const clock = new FixedStepClock();
    const r = clock.advance(75);
    expect(r.steps).toBe(1);
    expect(r.alpha).toBeCloseTo(0.5);
  });

  it('caps steps per frame after a long stall', () => {
    const clock = new FixedStepClock(5);
    expect(clock.advance(10_000).steps).toBe(5);
    expect(clock.advance(0).steps).toBe(0);
  });
});
