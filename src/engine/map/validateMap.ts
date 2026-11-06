/**
 * Map validator (PLAN §8.2). Checks that a decoded map is playable and fair for 1v1.
 * Returns errors (the map must not be used) and warnings (worth a look, still playable).
 */
import { objectCenter, type DecodedMap, type MapObject } from '../../shared';
import { TERRAIN_RULES } from './Grid';
import { isResourceKind, loadMap, type LoadedMap, type ResourceNodeSpawn, type SpawnPoint } from './loadMap';

export interface ValidationResult {
  errors: string[];
  warnings: string[];
  /** Per-spawn resource summary, useful for balancing and tool output. */
  summary: SpawnSummary[];
}

export interface SpawnSummary {
  player: number;
  goldMinesWithin8: number;
  berriesWithin8: number;
  treesWithin12: number;
  goldMinesWithin20: number;
  /** Total of each resource on the half of the map nearer to this spawn. */
  totals: { food: number; wood: number; gold: number };
}

export const RULES = {
  nearGoldRadius: 8,
  nearGoldMin: 1,
  nearBerriesMin: 6,
  woodRadius: 12,
  woodMin: 40,
  secondGoldRadius: 20,
  fairnessTolerance: 0.05,
  minSpawnDistance: 40,
} as const;

export function validateMap(map: DecodedMap): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  checkOverlaps(map, errors);

  const loaded = loadMap(map);
  const { spawns, resources } = loaded;
  if (spawns.length !== 2 || spawns[0]?.player !== 0 || spawns[1]?.player !== 1) {
    errors.push(`expected exactly one spawn_p1 and one spawn_p2, found ${spawns.length} spawn(s)`);
    return { errors, warnings, summary: [] };
  }
  const [p1, p2] = spawns as [SpawnPoint, SpawnPoint];

  for (const s of spawns) {
    for (let y = s.y; y < s.y + s.h; y++) {
      for (let x = s.x; x < s.x + s.w; x++) {
        const t = map.terrain[y * map.width + x];
        if (!t || !TERRAIN_RULES[t].buildable) {
          errors.push(
            `spawn of player ${s.player + 1}: Town Hall tile ${x},${y} is not buildable (${t ?? 'outside'})`,
          );
        }
      }
    }
  }

  const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
  if (dist < RULES.minSpawnDistance) {
    errors.push(`spawns are only ${dist.toFixed(1)} tiles apart (minimum ${RULES.minSpawnDistance})`);
  }

  // Reachability by land: flood fill from around each Town Hall.
  // The two bases must connect without cutting any trees.
  if (!touches(floodFrom(loaded, p1, false), loaded, p2))
    errors.push('player 2 cannot be reached by land from player 1');
  // A resource only needs to be reachable eventually: trees in the way can be cut down first.
  const reach1 = floodFrom(loaded, p1, true);
  const reach2 = floodFrom(loaded, p2, true);
  const unreachable = resources.filter((r) => {
    const nearest = distanceTo(r, p1) <= distanceTo(r, p2) ? reach1 : reach2;
    return !touches(nearest, loaded, r);
  });
  for (const r of unreachable.slice(0, 10)) {
    warnings.push(`${r.kind} at ${r.x},${r.y} cannot be reached from the nearest spawn`);
  }
  if (unreachable.length > 10) warnings.push(`…and ${unreachable.length - 10} more unreachable resources`);

  // Resources around each base.
  const summary = spawns.map((s) => summarize(s, resources, spawns));
  for (const s of summary) {
    const who = `player ${s.player + 1}`;
    if (s.goldMinesWithin8 < RULES.nearGoldMin)
      errors.push(`${who}: no gold mine within ${RULES.nearGoldRadius} tiles`);
    if (s.berriesWithin8 < RULES.nearBerriesMin)
      errors.push(
        `${who}: only ${s.berriesWithin8} berry bushes within ${RULES.nearGoldRadius} tiles (need ${RULES.nearBerriesMin})`,
      );
    if (s.treesWithin12 < RULES.woodMin)
      errors.push(
        `${who}: only ${s.treesWithin12} trees within ${RULES.woodRadius} tiles (need ${RULES.woodMin})`,
      );
    if (s.goldMinesWithin20 < 2)
      errors.push(`${who}: needs a second gold mine within ${RULES.secondGoldRadius} tiles`);
  }
  const [a, b] = summary as [SpawnSummary, SpawnSummary];
  for (const res of ['food', 'wood', 'gold'] as const) {
    const hi = Math.max(a.totals[res], b.totals[res]);
    const lo = Math.min(a.totals[res], b.totals[res]);
    if (hi > 0 && (hi - lo) / hi > RULES.fairnessTolerance) {
      errors.push(
        `unfair ${res}: ${a.totals[res]} vs ${b.totals[res]} (more than ${RULES.fairnessTolerance * 100}% apart)`,
      );
    }
  }

  if (map.symmetry === 'rotate180') checkSymmetry(map, errors);

  return { errors, warnings, summary };
}

// ---- helpers --------------------------------------------------------------------------------------

function checkOverlaps(map: DecodedMap, errors: string[]): void {
  const owner = new Int32Array(map.width * map.height).fill(-1);
  map.objects.forEach((o, idx) => {
    for (let y = o.y; y < o.y + o.h; y++) {
      for (let x = o.x; x < o.x + o.w; x++) {
        if (x >= map.width || y >= map.height) {
          errors.push(`${o.kind} at ${o.x},${o.y} sticks out of the map`);
          return;
        }
        const i = y * map.width + x;
        const prev = owner[i] ?? -1;
        if (prev >= 0) {
          const other = map.objects[prev];
          errors.push(`${o.kind} at ${o.x},${o.y} overlaps ${other?.kind} at ${other?.x},${other?.y}`);
          return;
        }
        owner[i] = idx;
        const t = map.terrain[i];
        if (o.kind !== 'spawn' && t && !TERRAIN_RULES[t].passable) {
          errors.push(`${o.kind} at ${o.x},${o.y} stands on ${t}`);
          return;
        }
      }
    }
  });
}

function center(r: { x: number; y: number; w: number; h: number }): { x: number; y: number } {
  return objectCenter(r as MapObject);
}

function distanceTo(r: { x: number; y: number; w: number; h: number }, s: SpawnPoint): number {
  const a = center(r);
  const b = center(s);
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function summarize(s: SpawnPoint, resources: ResourceNodeSpawn[], spawns: SpawnPoint[]): SpawnSummary {
  const within = (kinds: string[], radius: number): number =>
    resources.filter((r) => kinds.includes(r.kind) && distanceTo(r, s) <= radius).length;
  const totals = { food: 0, wood: 0, gold: 0 };
  for (const r of resources) {
    const d = distanceTo(r, s);
    const nearestOther = Math.min(...spawns.filter((o) => o !== s).map((o) => distanceTo(r, o)));
    if (d < nearestOther) totals[r.resource] += r.amount;
    else if (d === nearestOther) totals[r.resource] += r.amount / 2;
  }
  return {
    player: s.player,
    goldMinesWithin8: within(['gold_mine'], RULES.nearGoldRadius),
    berriesWithin8: within(['berry_bush'], RULES.nearGoldRadius),
    treesWithin12: within(['tree', 'pine'], RULES.woodRadius),
    goldMinesWithin20: within(['gold_mine'], RULES.secondGoldRadius),
    totals,
  };
}

/**
 * Flood fill over passable tiles, starting from the ring around a footprint.
 * With `throughTrees`, tiles holding trees count as passable (they can be cut down).
 */
function floodFrom(loaded: LoadedMap, s: SpawnPoint, throughTrees: boolean): Uint8Array {
  const { grid } = loaded;
  const treeTiles = new Uint8Array(grid.width * grid.height);
  if (throughTrees) {
    for (const r of loaded.resources) {
      if (r.kind === 'tree' || r.kind === 'pine') treeTiles[grid.index(r.x, r.y)] = 1;
    }
  }
  const open = (x: number, y: number): boolean =>
    grid.isPassable(x, y) ||
    (throughTrees && grid.inBounds(x, y) && treeTiles[grid.index(x, y)] === 1 && grid.rule(x, y).passable);
  const seen = new Uint8Array(grid.width * grid.height);
  const queue: number[] = [];
  for (const [x, y] of ring(s)) {
    if (open(x, y)) {
      const i = grid.index(x, y);
      if (!seen[i]) {
        seen[i] = 1;
        queue.push(i);
      }
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head] ?? 0;
    const x = i % grid.width;
    const y = Math.floor(i / grid.width);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (!open(nx, ny)) continue;
      const ni = grid.index(nx, ny);
      if (seen[ni]) continue;
      seen[ni] = 1;
      queue.push(ni);
    }
  }
  return seen;
}

function ring(r: { x: number; y: number; w: number; h: number }): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let x = r.x - 1; x <= r.x + r.w; x++) out.push([x, r.y - 1], [x, r.y + r.h]);
  for (let y = r.y; y < r.y + r.h; y++) out.push([r.x - 1, y], [r.x + r.w, y]);
  return out;
}

function touches(
  reached: Uint8Array,
  loaded: LoadedMap,
  r: { x: number; y: number; w: number; h: number },
): boolean {
  const { grid } = loaded;
  return ring(r).some(([x, y]) => grid.inBounds(x, y) && reached[grid.index(x, y)] === 1);
}

function checkSymmetry(map: DecodedMap, errors: string[]): void {
  const { width: W, height: H } = map;
  let terrainMismatches = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (map.terrain[y * W + x] !== map.terrain[(H - 1 - y) * W + (W - 1 - x)]) terrainMismatches++;
    }
  }
  if (terrainMismatches > 0)
    errors.push(`symmetry: ${terrainMismatches / 2} terrain tile pair(s) do not mirror`);

  const key = (o: MapObject): string => `${o.kind}:${o.x},${o.y}`;
  const keys = new Set(map.objects.filter((o) => o.kind !== 'stone').map(key));
  let objectMismatches = 0;
  for (const o of map.objects) {
    if (o.kind === 'stone') continue;
    const mirrored: MapObject = { ...o, x: W - o.x - o.w, y: H - o.y - o.h };
    if (!keys.has(key(mirrored))) objectMismatches++;
    if (o.kind === 'spawn' || !isResourceKind(o.kind)) continue;
    const twin = map.objects.find((m) => m.kind === o.kind && m.x === mirrored.x && m.y === mirrored.y);
    if (twin && (twin.amount ?? -1) !== (o.amount ?? -1)) objectMismatches++;
  }
  if (objectMismatches > 0) errors.push(`symmetry: ${objectMismatches} object(s) have no mirrored twin`);
}
