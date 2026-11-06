/**
 * Loads game data files from the game's own origin (maps/ is a top-level static folder).
 * Only same-origin requests: the page's CSP (connect-src 'self') forbids anything else.
 */
import { MapIndexSchema, type MapIndex } from '../shared';

const BASE = import.meta.env.BASE_URL;

async function fetchJson(path: string): Promise<unknown> {
  const response = await fetch(`${BASE}${path}`, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Could not load ${path} (HTTP ${response.status})`);
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new Error(`${path} is not valid JSON`);
  }
}

export async function loadMapIndex(): Promise<MapIndex> {
  const parsed = MapIndexSchema.safeParse(await fetchJson('maps/index.json'));
  if (!parsed.success) throw new Error(`maps/index.json is invalid: ${parsed.error.message}`);
  return parsed.data;
}

export async function loadMapFile(file: string): Promise<unknown> {
  if (!/^[a-z0-9_]+\.json$/.test(file)) throw new Error(`Unexpected map file name "${file}"`);
  return fetchJson(`maps/${file}`);
}
