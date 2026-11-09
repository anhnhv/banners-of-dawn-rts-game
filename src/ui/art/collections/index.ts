/**
 * The art collections and the active one. Every art lookup (palette colors, HUD icons, voxel
 * models) goes through art(), which takes the part from the active collection and falls back to
 * `classic` for anything the active collection does not define.
 *
 * To add a collection: write it (see autumn.ts) and add it to ART_COLLECTIONS below.
 * The game starts with DEFAULT_ART_ID; switch with `?art=<id>` (`?art=classic` for the base look). Switch before anything is drawn: meshes and icons already made keep
 * their old look (the HUD gallery redraws everything when it switches).
 */
import { autumn } from './autumn';
import { classic } from './classic';
import { aetherfall } from './aetherfall';
import type { ArtCollection, ArtCollectionParts, BaseArtCollection } from './types';

export type * from './types';

export const ART_COLLECTIONS: readonly ArtCollection[] = [classic, autumn, aetherfall];

/** The collection used when the URL names none (or an unknown one). */
export const DEFAULT_ART_ID = aetherfall.id;

/** Merge a collection over classic: maps entry by entry, everything else replaced when given. */
function resolve(c: ArtCollection): BaseArtCollection {
  if (c === classic) return classic;
  const merged = { ...classic, id: c.id, name: c.name } as BaseArtCollection;
  const target = merged as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(c)) {
    if (value === undefined || key === 'id' || key === 'name') continue;
    const base = (classic as unknown as Record<string, unknown>)[key];
    const isMap =
      typeof value === 'object' && !Array.isArray(value) && typeof base === 'object' && !Array.isArray(base);
    target[key] = isMap ? { ...(base as object), ...(value as object) } : value;
  }
  // teams are a map of maps
  for (const team of Object.keys(classic.teams) as Array<keyof ArtCollectionParts['teams']>)
    merged.teams = { ...merged.teams, [team]: { ...classic.teams[team], ...c.teams?.[team] } };
  return merged;
}

let active: ArtCollection = aetherfall;
let resolved: BaseArtCollection = resolve(aetherfall);

/** The active collection, complete (missing parts filled in from classic). */
export function art(): BaseArtCollection {
  return resolved;
}

/** Id of the active collection. */
export function artId(): string {
  return active.id;
}

/** Make a collection active. Missing or unknown ids select the default. Returns the id now active. */
export function setArtCollection(id: string | null | undefined): string {
  active = ART_COLLECTIONS.find((c) => c.id === id) ?? aetherfall;
  resolved = resolve(active);
  return active.id;
}
