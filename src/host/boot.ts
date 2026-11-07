/**
 * Boot sequence: load the map index and a map, decode it, validate it with the engine,
 * create the Game and the in-game screen, and start the host loop.
 */
import { decodeMap, MapFormatError } from '../shared';
import { createGame, validateMap } from '../engine';
import { createGameScreen, showFatalError } from '../ui';
import { DEFAULT_AI_MODE, type AIMode } from '../ai';
import { WorkerAIController } from './aiController';
import { GameHost } from './GameHost';
import { loadMapFile, loadMapIndex } from './loaders';

export interface BootOptions {
  mapId?: string | null;
  /** Dev: extra units for the human player (`?army=50`). */
  testArmy?: number;
  /** Dev: enemy units between the bases (`?enemy=20`). */
  testEnemy?: number;
  /** Use the map's ready-made scenario start if it has one (default true; `?setup=standard` = off). */
  scenario?: boolean;
  /** Machine player mode for player 2 (`?ai=easy|normal`, default easy); null = an idle opponent (`?ai=off`). */
  ai?: AIMode | null;
  seed?: number;
}

export async function bootGame(container: HTMLElement, options: BootOptions = {}): Promise<void> {
  const requestedMapId = options.mapId;
  try {
    const index = await loadMapIndex();
    const entry =
      index.maps.find((m) => m.id === requestedMapId) ??
      index.maps.find((m) => m.recommended) ??
      index.maps[0];
    if (!entry) throw new Error('maps/index.json lists no maps');

    const map = decodeMap(await loadMapFile(entry.file));
    const result = validateMap(map);
    if (result.errors.length > 0) {
      showFatalError(container, `Map "${map.name}" is not valid`, result.errors);
      return;
    }
    const game = createGame(map, {
      seed: options.seed ?? 1,
      testArmy: options.testArmy,
      testEnemy: options.testEnemy,
      scenario: options.scenario ?? true,
    });
    const host = new GameHost(game, 0);
    const screen = createGameScreen(container, map, {
      player: 0,
      onCommand: (cmd) => host.issue(cmd),
      warnings: result.warnings,
    });
    host.attach(screen);
    const mode = options.ai === undefined ? DEFAULT_AI_MODE : options.ai;
    if (mode) host.attachAI(new WorkerAIController(game, 1, mode, host.aiSink, options.seed ?? 1));
    else screen.setOpponentStatus('Opponent: idle (?ai=off)');
    host.start();
  } catch (err) {
    if (err instanceof MapFormatError) {
      showFatalError(container, 'The map file has errors', err.issues);
    } else {
      showFatalError(container, 'The game could not start', [
        err instanceof Error ? err.message : String(err),
      ]);
    }
  }
}
