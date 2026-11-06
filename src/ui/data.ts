/** The UI's copy of the game data (same JSON and validation as the engine). */
import { parseGameData, type GameData } from '../shared';
import buildings from '../data/buildings.json';
import game from '../data/game.json';
import resources from '../data/resources.json';
import units from '../data/units.json';

export const DATA: GameData = parseGameData({
  units: units.units,
  buildings: buildings.buildings,
  nodes: resources.nodes,
  resources: resources.types,
  game,
});

/** Display name of any entity type id. */
export function displayName(type: string): string {
  return DATA.units[type]?.name ?? DATA.buildings[type]?.name ?? DATA.nodes[type]?.name ?? type;
}
