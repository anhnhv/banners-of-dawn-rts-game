/** The engine's copy of the game data, validated once at startup (throws on bad data). */
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
