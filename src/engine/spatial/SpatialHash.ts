/** Uniform-grid spatial hash for neighbour queries (separation now, targeting from M5). */
export class SpatialHash<T extends { x: number; y: number }> {
  private readonly cells = new Map<number, T[]>();

  constructor(private readonly cellSize = 1) {}

  clear(): void {
    this.cells.clear();
  }

  insert(item: T): void {
    const key = this.key(Math.floor(item.x / this.cellSize), Math.floor(item.y / this.cellSize));
    let cell = this.cells.get(key);
    if (!cell) {
      cell = [];
      this.cells.set(key, cell);
    }
    cell.push(item);
  }

  /** Calls fn for every item in cells overlapping the square of half-size `radius` around (x, y). */
  forEachNear(x: number, y: number, radius: number, fn: (item: T) => void): void {
    const x0 = Math.floor((x - radius) / this.cellSize);
    const x1 = Math.floor((x + radius) / this.cellSize);
    const y0 = Math.floor((y - radius) / this.cellSize);
    const y1 = Math.floor((y + radius) / this.cellSize);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const cell = this.cells.get(this.key(cx, cy));
        if (cell) for (const item of cell) fn(item);
      }
    }
  }

  private key(cx: number, cy: number): number {
    return (cy + 1024) * 4096 + (cx + 1024);
  }
}
