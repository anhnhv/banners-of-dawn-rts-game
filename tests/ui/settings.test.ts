/** Settings and the last match setup in localStorage (docs/plans/m7-menus-art-maps.md §4). */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  loadLastSetup,
  loadSettings,
  saveLastSetup,
  saveSettings,
  type KeyValueStore,
} from '../../src/ui/settings';
import type { MatchSetup } from '../../src/shared';

function memoryStore(): NonNullable<KeyValueStore> & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

const DEFAULT_SETUP: MatchSetup = {
  map: 'green_valley',
  opponent: 'easy',
  start: 'scenario',
  pace: 'standard',
  speed: 1,
};
const VALID = {
  maps: ['green_valley', 'twin_rivers'],
  opponents: ['easy', 'normal', 'off'],
  paces: ['standard', 'fast'],
  speeds: [0.5, 1, 1.5, 2],
};

describe('settings', () => {
  it('round-trips through the store', () => {
    const store = memoryStore();
    const s = { ...DEFAULT_SETTINGS, shadows: false, scrollSpeed: 'fast' as const, showFps: true };
    saveSettings(s, store);
    expect(loadSettings(store)).toEqual(s);
  });

  it('no storage, broken JSON or bad values give the defaults, field by field', () => {
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
    const store = memoryStore();
    store.data.set('bod.settings.v1', '{not json');
    expect(loadSettings(store)).toEqual(DEFAULT_SETTINGS);
    store.data.set('bod.settings.v1', JSON.stringify({ shadows: 'yes', quality: 'low', scrollSpeed: 9 }));
    expect(loadSettings(store)).toEqual({ ...DEFAULT_SETTINGS, quality: 'low' });
  });

  it('a store that throws never breaks the game', () => {
    const angry: KeyValueStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
    };
    expect(() => saveSettings(DEFAULT_SETTINGS, angry)).not.toThrow();
    expect(loadSettings(angry)).toEqual(DEFAULT_SETTINGS);
  });
});

describe('last match setup', () => {
  it('round-trips, and values that no longer exist fall back', () => {
    const store = memoryStore();
    const setup: MatchSetup = {
      map: 'twin_rivers',
      opponent: 'normal',
      start: 'standard',
      pace: 'fast',
      speed: 1.5,
    };
    saveLastSetup(setup, store);
    expect(loadLastSetup(DEFAULT_SETUP, VALID, store)).toEqual(setup);
    saveLastSetup({ ...setup, map: 'deleted_map', pace: 'warp', speed: 7 }, store);
    expect(loadLastSetup(DEFAULT_SETUP, VALID, store)).toEqual({
      ...setup,
      map: 'green_valley',
      pace: 'standard',
      speed: 1,
    });
  });
});
