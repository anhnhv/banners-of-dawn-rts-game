/**
 * Player settings (docs/plans/m7-menus-art-maps.md §4) and the last match setup, kept in
 * localStorage. Storage may be missing or blocked (private windows, previews): every read and
 * write is wrapped, and anything missing or invalid falls back to the defaults, field by field.
 */
import type { MatchSetup } from '../shared';

export interface Settings {
  edgeScroll: boolean;
  scrollSpeed: 'slow' | 'normal' | 'fast';
  shadows: boolean;
  quality: 'high' | 'low';
  showFps: boolean;
  showAiStatus: boolean;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  edgeScroll: true,
  scrollSpeed: 'normal',
  shadows: true,
  quality: 'high',
  showFps: false,
  showAiStatus: true,
};

/** Camera pan speed factor of each scroll speed. */
export const SCROLL_FACTOR: Record<Settings['scrollSpeed'], number> = { slow: 0.6, normal: 1, fast: 1.6 };

const SETTINGS_KEY = 'bod.settings.v1';
const SETUP_KEY = 'bod.setup.v1';

/** The storage to use; null when there is none (tests can pass their own). */
export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'> | null;

function defaultStore(): KeyValueStore {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function readJson(store: KeyValueStore, key: string): Record<string, unknown> {
  try {
    const raw = store?.getItem(key);
    const value: unknown = raw ? JSON.parse(raw) : null;
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function writeJson(store: KeyValueStore, key: string, value: unknown): void {
  try {
    store?.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked: the setting still applies for this page
  }
}

const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
  typeof v === 'string' && (options as readonly string[]).includes(v) ? (v as T) : fallback;
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

export function loadSettings(store: KeyValueStore = defaultStore()): Settings {
  const raw = readJson(store, SETTINGS_KEY);
  const d = DEFAULT_SETTINGS;
  return {
    edgeScroll: bool(raw.edgeScroll, d.edgeScroll),
    scrollSpeed: oneOf(raw.scrollSpeed, ['slow', 'normal', 'fast'], d.scrollSpeed),
    shadows: bool(raw.shadows, d.shadows),
    quality: oneOf(raw.quality, ['high', 'low'], d.quality),
    showFps: bool(raw.showFps, d.showFps),
    showAiStatus: bool(raw.showAiStatus, d.showAiStatus),
  };
}

export function saveSettings(settings: Settings, store: KeyValueStore = defaultStore()): void {
  writeJson(store, SETTINGS_KEY, settings);
}

/** The last match setup, checked against the current choices (unknown values → `fallback`). */
export function loadLastSetup(
  fallback: MatchSetup,
  valid: {
    maps: readonly string[];
    opponents: readonly string[];
    paces: readonly string[];
    speeds: readonly number[];
  },
  store: KeyValueStore = defaultStore(),
): MatchSetup {
  const raw = readJson(store, SETUP_KEY);
  return {
    map: oneOf(raw.map, valid.maps, fallback.map),
    opponent: oneOf(raw.opponent, valid.opponents, fallback.opponent),
    start: oneOf(raw.start, ['scenario', 'standard'], fallback.start),
    pace: oneOf(raw.pace, valid.paces, fallback.pace),
    speed: typeof raw.speed === 'number' && valid.speeds.includes(raw.speed) ? raw.speed : fallback.speed,
  };
}

export function saveLastSetup(setup: MatchSetup, store: KeyValueStore = defaultStore()): void {
  writeJson(store, SETUP_KEY, setup);
}
