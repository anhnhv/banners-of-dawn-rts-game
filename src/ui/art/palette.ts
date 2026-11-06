import paletteData from '../../data/palette.json';

export type TeamName = keyof typeof paletteData.teams;
export type TeamSlot = 'team' | 'team-light' | 'team-dark';

const colors = new Map(paletteData.colors.map((c) => [c.id, c.hex]));

/** Hex color for a palette id. Throws on typos so mistakes show up immediately. */
export function hex(id: string): string {
  const value = colors.get(id);
  if (!value) throw new Error(`Unknown palette color "${id}"`);
  return value;
}

/** Resolve a palette id or team slot for a given team. */
export function resolveColor(id: string, team: TeamName): string {
  if (id === 'team' || id === 'team-light' || id === 'team-dark') {
    return paletteData.teams[team][id];
  }
  return hex(id);
}

export const TEAMS = Object.keys(paletteData.teams) as TeamName[];
