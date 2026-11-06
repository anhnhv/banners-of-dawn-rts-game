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
import type { DecodedMap } from '../shared';
import { StylePreview } from './preview/StylePreview';
import { MapViewScreen, type MapViewOptions } from './screens/MapViewScreen';

export { showFatalError } from './screens/ErrorScreen';

/** The style-preview diorama (open the game with `?preview`). */
export function startStylePreview(container: HTMLElement): StylePreview {
  const app = new StylePreview(container);
  app.start();
  return app;
}

/** Show a decoded map in the 3D view (M1). */
export function createMapView(
  container: HTMLElement,
  map: DecodedMap,
  options?: MapViewOptions,
): MapViewScreen {
  const screen = new MapViewScreen(container, map, options);
  screen.start();
  return screen;
}
