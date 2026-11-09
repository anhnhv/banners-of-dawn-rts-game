/** Match setup ⇄ URL (docs/plans/m7-menus-art-maps.md §2.8). */
import { describe, expect, it } from 'vitest';
import { devFromParams, setupFromParams, setupQuery, wantsDirectStart } from '../../src/host/setupUrl';
import type { MatchSetup } from '../../src/shared';

const BASE: MatchSetup = {
  map: 'green_valley',
  opponent: 'easy',
  start: 'scenario',
  pace: 'standard',
  speed: 1,
};
const CHOICES = {
  maps: ['green_valley', 'forest_pass'],
  opponents: ['easy', 'normal'],
  paces: ['standard', 'blitz'],
};
const params = (q: string): URLSearchParams => new URLSearchParams(q);

describe('setup URL', () => {
  it('/ shows the menu; any match parameter starts at once', () => {
    expect(wantsDirectStart(params(''))).toBe(false);
    expect(wantsDirectStart(params('?preview'))).toBe(false);
    for (const q of ['?play', '?ai=normal', '?setup=standard', '?map=forest_pass', '?army=5', '?speed=2'])
      expect(wantsDirectStart(params(q)), q).toBe(true);
  });

  it('a setup survives the round trip, with the dev extras', () => {
    const setup: MatchSetup = {
      map: 'forest_pass',
      opponent: 'off',
      start: 'standard',
      pace: 'blitz',
      speed: 1.5,
    };
    const q = params(setupQuery(setup, { army: 20, enemy: 0 }));
    expect(setupFromParams(q, BASE, CHOICES)).toEqual(setup);
    expect(devFromParams(q)).toEqual({ army: 20, enemy: 0 });
  });

  it('only the given values change; unknown values keep the base', () => {
    expect(setupFromParams(params('?ai=normal'), BASE, CHOICES)).toEqual({ ...BASE, opponent: 'normal' });
    expect(
      setupFromParams(params('?map=moon&ai=godlike&setup=x&pace=warp&speed=abc'), BASE, CHOICES),
    ).toEqual(BASE);
    expect(setupFromParams(params('?speed=1.4'), BASE, CHOICES).speed).toBe(1.5);
    expect(devFromParams(params('?army=9999&enemy=-3'))).toEqual({ army: 400, enemy: 0 });
  });
});
