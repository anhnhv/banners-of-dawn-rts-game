/**
 * Match setup ⇄ URL (docs/plans/m7-menus-art-maps.md §2.8). Any match parameter skips the menu and
 * starts at once, so the dev shortcuts (/?ai=normal, /?setup=standard, …) keep working.
 * Restart and Play again reload the page with the URL of the same setup.
 */
import { clampSpeed, IDLE_OPPONENT, type MatchSetup } from '../shared';

/** Parameters that start a match at once instead of showing the Main Menu. */
const MATCH_PARAMS = ['play', 'map', 'ai', 'setup', 'pace', 'speed', 'army', 'enemy'] as const;

export interface SetupChoices {
  maps: readonly string[];
  opponents: readonly string[];
  paces: readonly string[];
}

/** Dev-only extras carried over on restart. */
export interface DevOptions {
  army: number;
  enemy: number;
}

export function wantsDirectStart(params: URLSearchParams): boolean {
  return MATCH_PARAMS.some((p) => params.has(p));
}

/** The setup the URL asks for, on top of `base`; unknown values keep the base value. */
export function setupFromParams(
  params: URLSearchParams,
  base: MatchSetup,
  choices: SetupChoices,
): MatchSetup {
  const pick = (value: string | null, allowed: readonly string[], fallback: string): string =>
    value !== null && allowed.includes(value) ? value : fallback;
  const start = params.get('setup');
  const speed = Number(params.get('speed'));
  return {
    map: pick(params.get('map'), choices.maps, base.map),
    opponent: pick(params.get('ai'), [...choices.opponents, IDLE_OPPONENT], base.opponent),
    start: start === 'standard' || start === 'scenario' ? start : base.start,
    pace: pick(params.get('pace'), choices.paces, base.pace),
    speed: params.has('speed') && Number.isFinite(speed) && speed > 0 ? clampSpeed(speed) : base.speed,
  };
}

export function devFromParams(params: URLSearchParams): DevOptions {
  const n = (key: string): number => {
    const v = Number(params.get(key) ?? 0);
    return Number.isFinite(v) ? Math.min(400, Math.max(0, Math.floor(v))) : 0;
  };
  return { army: n('army'), enemy: n('enemy') };
}

/** "?play&map=…&ai=…&setup=…&pace=…&speed=…" (+ dev extras when set). */
export function setupQuery(setup: MatchSetup, dev: DevOptions = { army: 0, enemy: 0 }): string {
  const q = new URLSearchParams();
  q.set('map', setup.map);
  q.set('ai', setup.opponent);
  q.set('setup', setup.start);
  q.set('pace', setup.pace);
  q.set('speed', String(setup.speed));
  if (dev.army > 0) q.set('army', String(dev.army));
  if (dev.enemy > 0) q.set('enemy', String(dev.enemy));
  return `?play&${q.toString()}`;
}
