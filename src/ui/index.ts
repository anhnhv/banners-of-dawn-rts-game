/**
 * UI: public API
 * 3D voxel/low-poly rendering with pixel textures (three.js), HUD, menus, input and audio (PLAN §7).
 * Rules: imports only src/shared and src/data (plus npm packages); never engine internals or the AI.
 * The UI turns player input into Commands and draws read-only, fog-filtered views.
 */
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import './style.css';
import './hud/hud.css';
import './screens/menu.css';
import type { DecodedMap } from '../shared';
import { ModelViewer } from './preview/ModelViewer';
import { StylePreview } from './preview/StylePreview';
import { GameScreen, type GameScreenOptions, type MatchControls } from './screens/GameScreen';
import {
  MainMenu,
  type MapChoice,
  type MenuCallbacks,
  type MenuChoice,
  type MenuData,
} from './screens/MainMenu';
import type { Settings } from './settings';

export type { GameScreen, GameScreenOptions, MatchControls, MapChoice, MenuChoice, MenuData, Settings };

export { showFatalError } from './screens/ErrorScreen';
export { showLoading } from './screens/MainMenu';
export { loadLastSetup, loadSettings, saveLastSetup, saveSettings } from './settings';

/** The style-preview diorama (open the game with `?preview`). */
export function startStylePreview(container: HTMLElement): StylePreview {
  const app = new StylePreview(container);
  app.start();
  return app;
}

/** The model viewer: every model and icon for review (open the game with `?models`). */
export function startModelViewer(container: HTMLElement): ModelViewer {
  const app = new ModelViewer(container);
  app.start();
  return app;
}

/** The Main Menu (with Match Setup, Settings and How to Play). */
export function createMainMenu(
  container: HTMLElement,
  data: MenuData,
  settings: Settings,
  callbacks: MenuCallbacks,
): MainMenu {
  return new MainMenu(container, data, settings, callbacks);
}

/** Create the in-game screen. The host drives it by calling frame() every animation frame. */
export function createGameScreen(
  container: HTMLElement,
  map: DecodedMap,
  options: GameScreenOptions,
): GameScreen {
  return new GameScreen(container, map, options);
}
