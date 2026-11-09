/**
 * Voxel models (PLAN §7): turns the active art collection's drawings (src/ui/art/collections)
 * into geometry. All art is made in code from boxes + roofs + pixel textures.
 *
 * Conventions (1 world unit = 1 map tile):
 *  - Buildings / resources: origin at the footprint's min corner, footprint w×d tiles on +x/+z.
 *  - Units / trees: origin at the center of the feet, facing +z.
 *  - Colors are palette ids; 'team', 'team-light', 'team-dark' are swapped per player.
 */
import * as THREE from 'three';
import { art, type LegPart, type UnitKit } from './collections';
import type { BuildingModel, TeamName, TreeModel, UnitModel, WallAxis } from './collections';
import { classic } from './collections/classic';
import { voxelMaterial } from './materials';
import { resolveColor } from './palette';
import { VoxelBuilder, type BuiltGeometry } from './VoxelBuilder';

export type { BuildingModel, LegPart, TreeModel, UnitModel, WallAxis };

function builder(team: TeamName): VoxelBuilder {
  return new VoxelBuilder().setColorFilter((c) =>
    typeof c === 'string' && !c.startsWith('#') ? resolveColor(c, team) : c,
  );
}

function draw(fn: (b: VoxelBuilder) => void, team: TeamName = 'blue'): BuiltGeometry {
  const b = builder(team);
  fn(b);
  return b.build();
}

export function meshFrom(built: BuiltGeometry): THREE.Mesh {
  const mesh = new THREE.Mesh(
    built.geometry,
    built.textures.map((t) => voxelMaterial(t)),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// ---- Buildings ----------------------------------------------------------------------------------

const UNIT_MODELS = Object.keys(classic.units) as UnitModel[];

/** Resolve a config `model` name to a known unit model (unknown names fall back to militia). */
export function unitModel(name: string): UnitModel {
  return (UNIT_MODELS as readonly string[]).includes(name) ? (name as UnitModel) : 'militia';
}

/** Resolve a config `model` name to a known building model, or null if there is none yet. */
export function buildingModel(name: string): BuildingModel | null {
  return name in classic.buildings ? (name as BuildingModel) : null;
}

export function buildingGeometry(model: BuildingModel, team: TeamName): BuiltGeometry {
  return draw(art().buildings[model], team);
}

/** One 1×1 wall segment running along `axis`, with merlons. */
export function wallGeometry(axis: WallAxis): BuiltGeometry {
  return draw((b) => art().wall(b, axis));
}

// ---- Trees and rocks ----------------------------------------------------------------------------

export function treeGeometry(model: TreeModel): BuiltGeometry {
  return draw(art().trees[model]);
}

/** Boulder block that fills one 'rock' terrain tile (3 variants). Origin: tile center. */
export function rockBlockGeometry(variant: 0 | 1 | 2): BuiltGeometry {
  return draw(art().rockBlocks[variant]);
}

export function rockGeometry(): BuiltGeometry {
  return draw(art().boulder);
}

// ---- Units ---------------------------------------------------------------------------------------

/** The pieces of a unit model: a rigid body plus legs that swing when walking. */
export interface UnitPartGeometry {
  body: BuiltGeometry;
  legs: LegPart[];
  /** Left and right arm (people only), pivoting at the shoulder. Tools are part of the arm. */
  arms: LegPart[];
}

/** A unit as a scene-graph group (used by the style preview). */
export interface UnitParts {
  group: THREE.Group;
  legs: THREE.Object3D[];
}

export function unitParts(model: UnitModel, team: TeamName): UnitPartGeometry {
  const kit: UnitKit = { body: builder(team), team, part: () => builder(team), legs: [], arms: [] };
  art().units[model](kit);
  return { body: kit.body.build(), legs: kit.legs, arms: kit.arms };
}

/** Unit as a scene-graph group with separate leg meshes (style preview). */
export function buildUnit(model: UnitModel, team: TeamName): UnitParts {
  const parts = unitParts(model, team);
  const group = new THREE.Group();
  const part = (l: LegPart): THREE.Mesh => {
    const mesh = meshFrom(l.geometry);
    mesh.position.set(...l.pivot);
    return mesh;
  };
  const legs = parts.legs.map(part);
  group.add(meshFrom(parts.body), ...legs, ...parts.arms.map(part));
  group.name = `${team}:${model}`;
  return { group, legs };
}

// ---- Construction site, projectiles and rubble -------------------------------------------------

/** Static part of a construction site for a w×h footprint (the same for every building type). */
export function constructionSiteGeometry(w: number, h: number, height: number): BuiltGeometry {
  return draw((b) => art().constructionSite(b, w, h, height));
}

/** The part that grows with progress: a unit-height block (scaled in y by the renderer). */
export function constructionCoreGeometry(w: number, h: number): BuiltGeometry {
  return draw((b) => art().constructionCore(b, w, h));
}

/** Projectile pointing along +z, centered on its origin. Unknown names fall back to the arrow. */
export function projectileGeometry(model: string): BuiltGeometry {
  const p = art().projectiles;
  return draw(p[model] ?? p.arrow);
}

/** Rubble left by ANY destroyed building (one generic look, sized from the footprint). */
export function rubbleGeometry(w: number, h: number): BuiltGeometry {
  return draw((b) => art().rubble(b, w, h));
}
