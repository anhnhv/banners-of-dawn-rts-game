/**
 * Construction (decided 2026-11-06): no workers. A placed construction site advances by itself,
 * finishing after buildTime / pace.buildSpeed seconds. Its HP grows from
 * construction.startHpFraction to full. Placement rules live here too.
 */
import { secondsToTicks, type BuildingTypeId } from '../../shared';
import { DATA } from '../data';
import type { Building, Rect } from '../entities/Building';
import type { GameState } from '../GameState';
import { approachPoint } from './reach';

export function buildTicks(type: BuildingTypeId): number {
  const def = DATA.buildings[type];
  return Math.max(1, secondsToTicks((def?.buildTime ?? 1) / DATA.game.pace.buildSpeed));
}

/** True if `type` is offered by the build menu (game.json → buildMenu). */
export function inBuildMenu(type: BuildingTypeId): boolean {
  return DATA.game.buildMenu.some((e) => e.building === type);
}

/** Every footprint tile is buildable terrain and free of buildings and resources. */
export function canPlace(state: GameState, rect: Rect): boolean {
  return state.grid.isAreaBuildable(rect.x, rect.y, rect.w, rect.h);
}

/** Move units standing on a new footprint to the nearest free spot around it. */
export function clearFootprint(state: GameState, rect: Rect): void {
  for (const u of state.units.values()) {
    const inside = u.x >= rect.x && u.x < rect.x + rect.w && u.y >= rect.y && u.y < rect.y + rect.h;
    if (!inside) continue;
    const spot = approachPoint(state.grid, rect, u);
    if (!spot) continue;
    u.x = spot.x;
    u.y = spot.y;
    u.prevX = spot.x;
    u.prevY = spot.y;
    u.path = null;
    u.pathPending = false;
    u.goal = null;
  }
}

export function constructionSystem(state: GameState): void {
  const start = DATA.game.construction.startHpFraction;
  for (const b of state.buildings.values()) {
    if (b.constructed) continue;
    const before = b.buildProgress / b.buildTotal;
    b.buildProgress = Math.min(b.buildTotal, b.buildProgress + 1);
    const after = b.buildProgress / b.buildTotal;
    // HP grows with progress (damage taken meanwhile is kept)
    b.hp = Math.min(b.maxHp, b.hp + (after - before) * b.maxHp * (1 - start));
    if (b.buildProgress >= b.buildTotal) finishConstruction(state, b);
  }
}

function finishConstruction(state: GameState, b: Building): void {
  b.constructed = true;
  b.hp = b.maxHp;
  state.events.push({ type: 'buildingCompleted', player: b.owner, building: b.id, buildingType: b.type });
}
