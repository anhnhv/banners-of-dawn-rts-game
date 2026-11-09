/**
 * An ART COLLECTION is one complete look for the game: palette, HUD icons and every voxel model
 * (buildings, units, trees, rocks, construction sites, rubble, projectiles).
 *
 * The `classic` collection defines everything. Any other collection only lists what it changes;
 * everything it leaves out is taken from `classic`. To make a new one, add a file next to
 * `autumn.ts` and register it in `collections/index.ts`. Pick it with `?art=<id>` (game and
 * `/?hud` gallery) or the gallery's art switcher.
 *
 * Drawing functions get a VoxelBuilder whose colors are palette ids (see src/data/palette.json):
 * 'team', 'team-light' and 'team-dark' are swapped per player. Conventions (1 unit = 1 map tile):
 *  - buildings / resource nodes: origin at the footprint's min corner, footprint on +x/+z;
 *  - units / trees: origin at the center of the feet, facing +z.
 */
import type { VoxelBuilder, BuiltGeometry } from '../VoxelBuilder';

export type TeamName = 'blue' | 'red';
export type TeamSlot = 'team' | 'team-light' | 'team-dark';

export type BuildingModel =
  'townHall' | 'house' | 'barracks' | 'stable' | 'farm' | 'tower' | 'goldMine' | 'berryBush';
export type UnitModel = 'worker' | 'militia' | 'archer' | 'scoutRider' | 'knight' | 'catapult';
export type TreeModel = 'oak' | 'oakTall' | 'pine' | 'pineSmall';
export type WallAxis = 'x' | 'z';

export type IconName =
  | 'food'
  | 'wood'
  | 'gold'
  | 'pop'
  | 'spear'
  | 'hammer'
  | 'flag'
  | 'sword'
  | 'worker'
  | 'townHall'
  | 'house'
  | 'tree'
  | 'bow'
  | 'horse'
  | 'knight'
  | 'stop'
  | 'shield'
  | 'barracks'
  | 'stable'
  | 'tower'
  | 'pine'
  | 'berryBush'
  | 'goldMine'
  | 'catapult'
  | 'menu';

/** Leg (or arm) geometry with its pivot point (hip / shoulder) in model space. */
export interface LegPart {
  geometry: BuiltGeometry;
  pivot: [number, number, number];
}

/** What a unit drawing gets: the rigid body, plus lists for the parts that swing when walking. */
export interface UnitKit {
  body: VoxelBuilder;
  team: TeamName;
  /** A fresh builder (same team colors) for a separate leg or arm part. */
  part(): VoxelBuilder;
  legs: LegPart[];
  arms: LegPart[];
}

export type Draw = (b: VoxelBuilder) => void;
export type FootprintDraw = (b: VoxelBuilder, w: number, h: number) => void;

export interface ArtCollectionParts {
  /** Palette colors by id (src/data/palette.json ids). */
  colors: Record<string, string>;
  teams: Record<TeamName, Record<TeamSlot, string>>;
  /** HUD icon pixels: one char = one pixel, looked up in `iconInk`; '.' = transparent. */
  iconInk: Record<string, string>;
  icons: Record<IconName, string[]>;
  buildings: Record<BuildingModel, Draw>;
  units: Record<UnitModel, (kit: UnitKit) => void>;
  trees: Record<TreeModel, Draw>;
  /** The three boulder blocks that fill 'rock' terrain tiles (origin: tile center). */
  rockBlocks: [Draw, Draw, Draw];
  /** The small loose boulder (map object 'stone'). */
  boulder: Draw;
  wall: (b: VoxelBuilder, axis: WallAxis) => void;
  /** Static part of every construction site, for a w×h footprint. */
  constructionSite: (b: VoxelBuilder, w: number, h: number, height: number) => void;
  /** The part that grows with progress: a unit-height block (scaled in y by the renderer). */
  constructionCore: FootprintDraw;
  /** Left by any destroyed building. */
  rubble: FootprintDraw;
  /** Projectiles by projectiles.json model name, pointing along +z. `arrow` is the fallback. */
  projectiles: Record<string, Draw> & { arrow: Draw };
}

/** The base collection: defines every part. */
export interface BaseArtCollection extends ArtCollectionParts {
  id: string;
  name: string;
}

/** Any other collection: only the parts it changes (maps are merged entry by entry). */
export interface ArtCollection {
  id: string;
  name: string;
  colors?: Partial<ArtCollectionParts['colors']>;
  teams?: Partial<Record<TeamName, Partial<Record<TeamSlot, string>>>>;
  iconInk?: Partial<ArtCollectionParts['iconInk']>;
  icons?: Partial<ArtCollectionParts['icons']>;
  buildings?: Partial<ArtCollectionParts['buildings']>;
  units?: Partial<ArtCollectionParts['units']>;
  trees?: Partial<ArtCollectionParts['trees']>;
  rockBlocks?: ArtCollectionParts['rockBlocks'];
  boulder?: Draw;
  wall?: ArtCollectionParts['wall'];
  constructionSite?: ArtCollectionParts['constructionSite'];
  constructionCore?: FootprintDraw;
  rubble?: FootprintDraw;
  projectiles?: Partial<Record<string, Draw>>;
}
