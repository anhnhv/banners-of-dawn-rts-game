/**
 * Victory (game.json → victory): a player who has owned one of the `defeatWhenLost` building types
 * and owns none any more (construction sites count) is defeated. Players who never had one (test
 * arenas without spawns) are never defeated. A player who surrendered is defeated too.
 * Runs after deaths; ends the match at most once.
 */
import type { PlayerId, PlayerStats } from '../../shared';
import { DATA } from '../data';
import type { GameState } from '../GameState';

const EMPTY_STATS: PlayerStats = { unitsTrained: 0, unitsLost: 0, buildingsBuilt: 0, buildingsLost: 0 };

export function victorySystem(state: GameState): void {
  if (state.result) return;
  const key = new Set(DATA.game.victory.defeatWhenLost);
  const alive = new Set<PlayerId>();
  for (const b of state.buildings.values()) if (b.hp > 0 && key.has(b.type)) alive.add(b.owner);
  const defeated: PlayerId[] = [];
  let surrender = false;
  for (const p of state.players.values()) {
    if (alive.has(p.id)) p.hadKeyBuilding = true;
    if (p.surrendered) {
      defeated.push(p.id);
      surrender = true;
    } else if (!alive.has(p.id) && p.hadKeyBuilding) defeated.push(p.id);
  }
  if (defeated.length === 0) return;
  const players = [...state.players.keys()];
  const survivors = players.filter((p) => !defeated.includes(p));
  const winner = survivors.length === 1 ? (survivors[0] as PlayerId) : null;
  state.result = {
    winner,
    reason: surrender ? 'surrender' : 'destroyed',
    tick: state.tick,
    stats: players.map((p) => ({ ...(state.players.get(p)?.stats ?? EMPTY_STATS) })),
  };
  state.events.push({ type: 'gameOver', winner });
}
