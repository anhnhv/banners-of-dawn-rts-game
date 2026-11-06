/**
 * GAME ENGINE: public API
 * Authoritative, deterministic simulation on a square tile grid (PLAN §5).
 * Rules: imports only src/shared and src/data; no DOM, no network, no Math.random/Date.
 * The isometric view is a UI concern; the engine never knows about it.
 *
 * Implemented from M1 (map loading) onward. Only this file is the engine's public surface;
 * src/host imports from here, nothing else does.
 */
import { TICK_RATE } from '../shared';

export const ENGINE_INFO = {
  name: 'Banners of Dawn engine',
  tickRate: TICK_RATE,
} as const;
