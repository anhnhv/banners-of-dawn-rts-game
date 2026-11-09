/**
 * The app's flow (docs/plans/m7-menus-art-maps.md §2): load the maps, then show the Main Menu, or
 * start a match at once when the URL has match parameters (setupUrl.ts). Restart and Play again
 * reload the page with the match URL; Quit goes back to `/`. A reload is the only way to be sure
 * nothing of the old match (WebGL context, AI worker, listeners) is left behind.
 */
import paceJson from '../data/pace.json';
import {
  decodeMap,
  DEFAULT_GAME_SPEED,
  GAME_SPEEDS,
  IDLE_OPPONENT,
  MapFormatError,
  parsePaceFile,
  rulesForPace,
  type MatchSetup,
} from '../shared';
import { AI_MODES, DEFAULT_AI_MODE, PROFILES } from '../ai';
import {
  createMainMenu,
  loadLastSetup,
  loadSettings,
  saveLastSetup,
  saveSettings,
  showFatalError,
  showLoading,
  type MapChoice,
  type MenuData,
  type Settings,
} from '../ui';
import { startMatch } from './boot';
import { loadMapFile, loadMapIndex } from './loaders';
import { devFromParams, setupFromParams, setupQuery, wantsDirectStart, type DevOptions } from './setupUrl';

const BASE = import.meta.env.BASE_URL;

export async function startApp(container: HTMLElement, search: string): Promise<void> {
  try {
    const params = new URLSearchParams(search);
    // the art collection (?art=, read in main.ts) survives the URL rewrite, restart and quit
    const art = params.get('art');
    const artQuery = art ? `art=${encodeURIComponent(art)}` : '';
    const pace = parsePaceFile(paceJson);
    const index = await loadMapIndex();
    const maps: MapChoice[] = [];
    const problems: string[] = [];
    for (const entry of index.maps) {
      try {
        const map = decodeMap(await loadMapFile(entry.file));
        maps.push({
          id: map.id,
          name: map.name,
          description: map.description,
          detail: `${map.width}×${map.height}`,
          map,
          hasScenario: !!map.scenario,
        });
      } catch (err) {
        problems.push(
          `${entry.file}: ${err instanceof MapFormatError ? err.issues.join('; ') : err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    problems.forEach((p) => console.error(`[maps] ${p}`));
    const first = maps.find((m) => index.maps.find((e) => e.id === m.id)?.recommended) ?? maps[0];
    if (!first) {
      showFatalError(
        container,
        'No map could be loaded',
        problems.length > 0 ? problems : ['maps/index.json lists no maps'],
      );
      return;
    }

    const opponents = [
      ...AI_MODES.map((mode) => ({
        id: mode,
        name: PROFILES[mode].name,
        description: PROFILES[mode].persona,
      })),
      { id: IDLE_OPPONENT, name: 'Idle', description: 'Does nothing at all. For practice and testing.' },
    ];
    const paces = pace.presets.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      detail: p.length,
    }));
    const defaults: MatchSetup = {
      map: first.id,
      opponent: DEFAULT_AI_MODE,
      start: 'scenario',
      pace: pace.default,
      speed: DEFAULT_GAME_SPEED,
    };
    const valid = {
      maps: maps.map((m) => m.id),
      opponents: opponents.map((o) => o.id),
      paces: paces.map((p) => p.id),
      speeds: GAME_SPEEDS,
    };
    const last = loadLastSetup(defaults, valid);
    let settings: Settings = loadSettings();
    const onSettings = (s: Settings): void => {
      settings = s;
      saveSettings(s);
    };

    const begin = (asked: MatchSetup, dev: DevOptions): void => {
      const choice = maps.find((m) => m.id === asked.map) ?? first;
      const setup: MatchSetup = {
        ...asked,
        map: choice.id,
        start: asked.start === 'scenario' && !choice.hasScenario ? 'standard' : asked.start,
      };
      saveLastSetup(setup);
      window.history.replaceState(
        null,
        '',
        `${BASE}${setupQuery(setup, dev)}${artQuery ? `&${artQuery}` : ''}`,
      );
      const hide = showLoading(container, `Loading ${choice.name}…`);
      // let the loading panel paint before building the 3D scene
      requestAnimationFrame(() =>
        setTimeout(() => {
          try {
            startMatch(container, {
              setup,
              map: choice.map,
              rules: rulesForPace(pace, setup.pace),
              dev,
              settings,
              onSettings,
              onRestart: () => window.location.reload(),
              onQuit: () => window.location.assign(artQuery ? `${BASE}?${artQuery}` : BASE),
            });
          } catch (err) {
            showFatalError(container, 'The game could not start', [
              err instanceof Error ? err.message : String(err),
            ]);
          } finally {
            hide();
          }
        }, 0),
      );
    };

    if (wantsDirectStart(params)) {
      begin(setupFromParams(params, last, valid), devFromParams(params));
      return;
    }
    const data: MenuData = {
      maps,
      opponents,
      paces,
      speeds: GAME_SPEEDS,
      setup: last,
      heroImage: `${BASE}assets/menu/hero.webp`,
    };
    const menu = createMainMenu(container, data, settings, {
      onStart: (setup) => {
        menu.dispose();
        begin(setup, { army: 0, enemy: 0 });
      },
      onSettings,
    });
  } catch (err) {
    showFatalError(container, 'The game could not start', [err instanceof Error ? err.message : String(err)]);
  }
}
