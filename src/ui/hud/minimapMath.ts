/**
 * Minimap projection (PLAN §7.10): the grid drawn as a diamond that matches the 45° camera,
 * flattened vertically by sin(pitch). Pure math, unit-tested.
 *
 *   u = (x − z) · s + offsetX          (screen right)
 *   v = (x + z) · s · flatten           (screen down)
 */
export interface MinimapProjection {
  /** Pixels per tile along a diagonal. */
  scale: number;
  flatten: number;
  offsetX: number;
  width: number;
  height: number;
  mapWidth: number;
  mapHeight: number;
}

export function makeMinimapProjection(
  mapWidth: number,
  mapHeight: number,
  targetWidthPx: number,
  flatten: number,
): MinimapProjection {
  const scale = targetWidthPx / (mapWidth + mapHeight);
  return {
    scale,
    flatten,
    offsetX: mapHeight * scale,
    width: (mapWidth + mapHeight) * scale,
    height: (mapWidth + mapHeight) * scale * flatten,
    mapWidth,
    mapHeight,
  };
}

export function gridToMinimap(p: MinimapProjection, x: number, z: number): { u: number; v: number } {
  return { u: (x - z) * p.scale + p.offsetX, v: (x + z) * p.scale * p.flatten };
}

export function minimapToGrid(p: MinimapProjection, u: number, v: number): { x: number; z: number } {
  const a = (u - p.offsetX) / p.scale; // x − z
  const b = v / (p.scale * p.flatten); // x + z
  return { x: (a + b) / 2, z: (b - a) / 2 };
}

/** The affine matrix (for CanvasRenderingContext2D.setTransform) that draws a 1-px-per-tile image. */
export function minimapTransform(p: MinimapProjection): [number, number, number, number, number, number] {
  return [p.scale, p.scale * p.flatten, -p.scale, p.scale * p.flatten, p.offsetX, 0];
}
