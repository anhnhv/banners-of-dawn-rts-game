/** The classic look: the base collection every other collection falls back to. */
import paletteData from '../../../../data/palette.json';
import type { BaseArtCollection } from '../types';
import { buildings } from './buildings';
import { iconInk, icons } from './icons';
import { boulder, rockBlocks, trees } from './nature';
import { constructionCore, constructionSite, projectiles, rubble, wall } from './structures';
import { units } from './units';

export const classic: BaseArtCollection = {
  id: 'classic',
  name: 'Classic',
  colors: Object.fromEntries(paletteData.colors.map((c) => [c.id, c.hex])),
  teams: paletteData.teams,
  iconInk,
  icons,
  buildings,
  units,
  trees,
  rockBlocks,
  boulder,
  wall,
  constructionSite,
  constructionCore,
  rubble,
  projectiles,
};
