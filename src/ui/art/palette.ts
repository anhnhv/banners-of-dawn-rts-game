/** Palette colors and team colors of the active art collection (see collections/). */
import { art } from './collections';
import type { TeamName, TeamSlot } from './collections';
import { classic } from './collections/classic';

export type { TeamName, TeamSlot };

/** Hex color for a palette id. Throws on typos so mistakes show up immediately. */
export function hex(id: string): string {
  const value = art().colors[id];
  if (!value) throw new Error(`Unknown palette color "${id}"`);
  return value;
}

/** Resolve a palette id or team slot for a given team. */
export function resolveColor(id: string, team: TeamName): string {
  if (id === 'team' || id === 'team-light' || id === 'team-dark') return art().teams[team][id];
  return hex(id);
}

export const TEAMS = Object.keys(classic.teams) as TeamName[];
