import { describe, expect, it } from 'vitest';
import {
  gridToMinimap,
  makeMinimapProjection,
  minimapToGrid,
  minimapTransform,
} from '../../src/ui/hud/minimapMath';

describe('minimap projection', () => {
  const p = makeMinimapProjection(80, 60, 280, 0.79);

  it('fits the diamond in the requested width with the corners where the camera shows them', () => {
    expect(p.width).toBeCloseTo(280);
    expect(gridToMinimap(p, 0, 0)).toEqual({ u: p.offsetX, v: 0 }); // top corner
    expect(gridToMinimap(p, 80, 60).v).toBeCloseTo(p.height); // bottom corner
    expect(gridToMinimap(p, 0, 60).u).toBeCloseTo(0); // left corner
    expect(gridToMinimap(p, 80, 0).u).toBeCloseTo(p.width); // right corner
  });

  it('round-trips grid ↔ minimap', () => {
    for (const [x, z] of [
      [0, 0],
      [12.5, 33.25],
      [79, 59],
    ] as const) {
      const { u, v } = gridToMinimap(p, x, z);
      const g = minimapToGrid(p, u, v);
      expect(g.x).toBeCloseTo(x, 9);
      expect(g.z).toBeCloseTo(z, 9);
    }
  });

  it('has a canvas transform that matches gridToMinimap', () => {
    const [a, b, c, d, e, f] = minimapTransform(p);
    const x = 17;
    const z = 42;
    const expected = gridToMinimap(p, x, z);
    expect(a * x + c * z + e).toBeCloseTo(expected.u);
    expect(b * x + d * z + f).toBeCloseTo(expected.v);
  });
});
