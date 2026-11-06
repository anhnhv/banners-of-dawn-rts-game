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
    this.forArea(x, y, w, h, (i) => (this.blockers[i] = (this.blockers[i] ?? 0) + 1));
  }

  unblock(x: number, y: number, w: number, h: number): void {
    this.forArea(x, y, w, h, (i) => (this.blockers[i] = Math.max(0, (this.blockers[i] ?? 0) - 1)));
  }

  private forArea(x: number, y: number, w: number, h: number, fn: (index: number) => void): void {
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++) if (this.inBounds(i, j)) fn(this.index(i, j));
  }
}
