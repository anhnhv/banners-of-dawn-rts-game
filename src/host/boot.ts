/**
 * Starting one match: validate the map with the engine, create the Game and the in-game screen,
 * attach the machine player (or none for an idle opponent) and start the host loop.
 * The menus and the URL handling are in app.ts.
 */
import { GAME_SPEEDS, IDLE_OPPONENT, type DecodedMap, type MatchRules, type MatchSetup } from '../shared';
import { createGame, validateMap } from '../engine';
import { createGameScreen, showFatalError, type Settings } from '../ui';
import { isAIMode, PROFILES } from '../ai';
import { WorkerAIController } from './aiController';
import { GameHost } from './GameHost';
import type { DevOptions } from './setupUrl';

export interface MatchOptions {
  setup: MatchSetup;
  map: DecodedMap;
  rules: MatchRules;
  dev: DevOptions;
  settings: Settings;
  onSettings(settings: Settings): void;
  /** Restart / Play again (the host reloads with the same setup). */
  onRestart(): void;
  /** Quit / Main menu. */
  onQuit(): void;
  seed?: number;
}

export function startMatch(container: HTMLElement, o: MatchOptions): GameHost | null {
  const { map, setup } = o;
  const result = validateMap(map);
  if (result.errors.length > 0) {
    showFatalError(container, `Map "${map.name}" is not valid`, result.errors);
    return null;
  }
  const seed = o.seed ?? 1;
  const game = createGame(map, {
    seed,
    testArmy: o.dev.army,
    testEnemy: o.dev.enemy,
    scenario: setup.start === 'scenario',
    rules: o.rules,
  });
  const host = new GameHost(game, 0);
  host.speed = setup.speed;
  const screen = createGameScreen(container, map, {
    player: 0,
    onCommand: (cmd) => host.issue(cmd),
    warnings: result.warnings,
    rules: o.rules,
    controls: {
      setPaused: (paused) => (host.paused = paused),
      setSpeed: (speed) => (host.speed = speed),
      restart: o.onRestart,
      quit: o.onQuit,
    },
    speeds: GAME_SPEEDS,
    speed: setup.speed,
    settings: o.settings,
    onSettings: o.onSettings,
  });
  host.attach(screen);
  if (setup.opponent !== IDLE_OPPONENT && isAIMode(setup.opponent))
    host.attachAI(new WorkerAIController(game, 1, PROFILES[setup.opponent], host.aiSink, seed));
  else screen.setOpponentStatus('Opponent: idle (does nothing)');
  host.start();
  return host;
}
