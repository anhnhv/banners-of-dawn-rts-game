/**
 * A* on the tile grid (PLAN §5.5): 8 directions, octile heuristic, no corner cutting,
 * terrain cost = 1 / terrain speed, binary heap, node cap. If the goal cannot be reached
 * (or the cap is hit) it returns the path to the closest node found.
 *
 * Scratch arrays are reused between searches (stamped with a search id) so a search allocates
 * almost nothing — important with dozens of path requests per second.
 */
import type { Grid } from '../map/Grid';

export interface PathResult {
  /** Tile indices from start to end (inclusive). Empty if the start itself is invalid. */
  tiles: number[];
  /** True if the end tile is the requested goal. */
  reachedGoal: boolean;
  /** Nodes expanded (for the per-tick budget). */
  expanded: number;
}

const SQRT2 = Math.SQRT2;
const DIRS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, SQRT2],
  [1, -1, SQRT2],
  [-1, 1, SQRT2],
  [-1, -1, SQRT2],
];

export class PathFinder {
  private readonly size: number;
  private readonly g: Float32Array;
  private readonly f: Float32Array;
  private readonly parent: Int32Array;
  private readonly openStamp: Uint32Array;
  private readonly closedStamp: Uint32Array;
  private readonly heap: Int32Array;
  private heapSize = 0;
  private stamp = 0;

  constructor(private readonly grid: Grid) {
    this.size = grid.width * grid.height;
    this.g = new Float32Array(this.size);
    this.f = new Float32Array(this.size);
    this.parent = new Int32Array(this.size);
    this.openStamp = new Uint32Array(this.size);
    this.closedStamp = new Uint32Array(this.size);
    this.heap = new Int32Array(this.size);
  }

  find(sx: number, sy: number, gx: number, gy: number, maxNodes = 6000): PathResult {
    const { grid } = this;
    if (!grid.inBounds(sx, sy) || !grid.inBounds(gx, gy))
      return { tiles: [], reachedGoal: false, expanded: 0 };
    const start = grid.index(sx, sy);
    const goal = grid.index(gx, gy);
    if (start === goal) return { tiles: [start], reachedGoal: true, expanded: 0 };

    this.stamp++;
    if (this.stamp === 0xffffffff) {
      this.openStamp.fill(0);
      this.closedStamp.fill(0);
      this.stamp = 1;
    }
    const stamp = this.stamp;
    this.heapSize = 0;
    this.g[start] = 0;
    this.f[start] = octile(sx, sy, gx, gy);
    this.parent[start] = -1;
    this.openStamp[start] = stamp;
    this.push(start);

    let best = start;
    let bestH = this.f[start] ?? 0;
    let expanded = 0;

    while (this.heapSize > 0) {
      const current = this.pop();
      if (this.closedStamp[current] === stamp) continue;
      this.closedStamp[current] = stamp;
      if (current === goal) return { tiles: this.trace(goal), reachedGoal: true, expanded };
      expanded++;
      const cx = current % grid.width;
      const cy = (current - cx) / grid.width;
      const h = octile(cx, cy, gx, gy);
      if (h < bestH) {
        bestH = h;
        best = current;
      }
      if (expanded >= maxNodes) break;

      const gCurrent = this.g[current] ?? 0;
      for (const [dx, dy, step] of DIRS) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (!grid.isPassable(nx, ny)) continue;
        // no corner cutting: a diagonal step needs both orthogonal neighbours free
        if (dx !== 0 && dy !== 0 && (!grid.isPassable(cx + dx, cy) || !grid.isPassable(cx, cy + dy)))
          continue;
        const n = grid.index(nx, ny);
        if (this.closedStamp[n] === stamp) continue;
        const cost = gCurrent + step / Math.max(0.1, grid.rule(nx, ny).speed);
        if (this.openStamp[n] === stamp && cost >= (this.g[n] ?? Infinity)) continue;
        this.g[n] = cost;
        this.f[n] = cost + octile(nx, ny, gx, gy);
        this.parent[n] = current;
        this.openStamp[n] = stamp;
        this.push(n);
      }
    }
    return { tiles: this.trace(best), reachedGoal: false, expanded };
  }

  private trace(end: number): number[] {
    const out: number[] = [];
    for (let n = end; n !== -1; n = this.parent[n] ?? -1) out.push(n);
    return out.reverse();
  }

  // ---- binary min-heap on f --------------------------------------------------------------------

  private push(node: number): void {
    const { heap, f } = this;
    let i = this.heapSize++;
    heap[i] = node;
    const fn = f[node] ?? 0;
    while (i > 0) {
      const p = (i - 1) >> 1;
      const pn = heap[p] ?? 0;
      if ((f[pn] ?? 0) <= fn) break;
      heap[i] = pn;
      i = p;
    }
    heap[i] = node;
  }

  private pop(): number {
    const { heap, f } = this;
    const top = heap[0] ?? 0;
    const last = heap[--this.heapSize] ?? 0;
    if (this.heapSize === 0) return top;
    const fl = f[last] ?? 0;
    let i = 0;
    for (;;) {
      const l = i * 2 + 1;
      if (l >= this.heapSize) break;
      const r = l + 1;
      const ln = heap[l] ?? 0;
      const rn = heap[r] ?? 0;
      const child = r < this.heapSize && (f[rn] ?? 0) < (f[ln] ?? 0) ? r : l;
      const cn = heap[child] ?? 0;
      if ((f[cn] ?? 0) >= fl) break;
      heap[i] = cn;
      i = child;
    }
    heap[i] = last;
    return top;
  }
}

function octile(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return dx + dy + (SQRT2 - 2) * Math.min(dx, dy);
}
