/**
 * Simulation grid (PLAN §5.5): terrain per tile plus a count of blockers (buildings, resources).
 * Pure data + queries, no rendering knowledge.
 */
import { TERRAIN_TYPES, type TerrainType } from '../../shared';
import terrainData from '../../data/terrain.json';

export interface TerrainRule {
  name: string;
  passable: boolean;
  buildable: boolean;
  speed: number;
}

export const TERRAIN_RULES: Record<TerrainType, TerrainRule> = terrainData.types;
const TERRAIN_INDEX = new Map<TerrainType, number>(TERRAIN_TYPES.map((t, i) => [t, i]));

export class Grid {
  /** Terrain type index per tile (into TERRAIN_TYPES). */
  readonly terrain: Uint8Array;
  /** Number of static blockers (buildings, resources) on each tile. */
  readonly blockers: Uint16Array;
  /** Bumped whenever a blocker is added or removed (invalidates the region labels). */
  private version = 0;
  private regionVersion = -1;
  private regions: Int32Array | null = null;

  constructor(
    readonly width: number,
    readonly height: number,
    terrain: readonly TerrainType[],
  ) {
    this.terrain = new Uint8Array(width * height);
    this.blockers = new Uint16Array(width * height);
    terrain.forEach((t, i) => (this.terrain[i] = TERRAIN_INDEX.get(t) ?? 0));
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  index(x: number, y: number): number {
    return y * this.width + x;
  }

  terrainAt(x: number, y: number): TerrainType {
    return TERRAIN_TYPES[this.terrain[this.index(x, y)] ?? 0] ?? 'grass';
  }

  rule(x: number, y: number): TerrainRule {
    return TERRAIN_RULES[this.terrainAt(x, y)];
  }

  /** Walkable by land units right now (terrain allows it and nothing stands there). */
  isPassable(x: number, y: number): boolean {
    return this.inBounds(x, y) && this.rule(x, y).passable && (this.blockers[this.index(x, y)] ?? 0) === 0;
  }

  /** A building may be placed here (terrain buildable and free). */
  isBuildable(x: number, y: number): boolean {
    return this.inBounds(x, y) && this.rule(x, y).buildable && (this.blockers[this.index(x, y)] ?? 0) === 0;
  }

  /** True if every tile of the w×h rectangle is buildable. */
  isAreaBuildable(x: number, y: number, w: number, h: number): boolean {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (!this.isBuildable(i, j)) return false;
    return true;
  }

  block(x: number, y: number, w: number, h: number): void {
    this.version++;
    this.forArea(x, y, w, h, (i) => (this.blockers[i] = (this.blockers[i] ?? 0) + 1));
  }

  unblock(x: number, y: number, w: number, h: number): void {
    this.version++;
    this.forArea(x, y, w, h, (i) => (this.blockers[i] = Math.max(0, (this.blockers[i] ?? 0) - 1)));
  }

  /**
   * Connected land region of a passable tile, or -1 for a blocked tile. Two tiles with the same
   * region can reach each other (A* moves diagonally only past two free orthogonal tiles, so
   * 4-neighbour connectivity is the same thing). Recomputed lazily after blockers change.
   */
  regionAt(x: number, y: number): number {
    if (!this.isPassable(x, y)) return -1;
    if (this.regionVersion !== this.version || !this.regions) this.labelRegions();
    return this.regions?.[this.index(x, y)] ?? -1;
  }

  private labelRegions(): void {
    const { width: w, height: h } = this;
    const labels = this.regions ?? new Int32Array(w * h);
    labels.fill(-1);
    const queue = new Int32Array(w * h);
    let next = 0;
    for (let start = 0; start < w * h; start++) {
      if (labels[start] !== -1 || !this.isPassable(start % w, Math.floor(start / w))) continue;
      const label = next++;
      labels[start] = label;
      let head = 0;
      let tail = 0;
      queue[tail++] = start;
      while (head < tail) {
        const i = queue[head++] ?? 0;
        const x = i % w;
        const y = (i - x) / w;
        for (const [nx, ny] of [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
        ] as const) {
          if (!this.isPassable(nx, ny)) continue;
          const n = ny * w + nx;
          if (labels[n] !== -1) continue;
          labels[n] = label;
          queue[tail++] = n;
        }
      }
    }
    this.regions = labels;
    this.regionVersion = this.version;
  }

  private forArea(x: number, y: number, w: number, h: number, fn: (index: number) => void): void {
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++) if (this.inBounds(i, j)) fn(this.index(i, j));
  }
}
