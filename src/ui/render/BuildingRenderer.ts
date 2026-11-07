/**
 * Draws buildings from the PlayerView.
 * - Finished buildings use the model named in their config (buildings.json → model); buildings
 *   without a model yet get a plain footprint block.
 * - Construction sites use ONE generic look for every building type (scaffold + rising block +
 *   progress bar), generated from the footprint size.
 * Also draws the selection outline and the rally flag, and supports picking by ray.
 */
import * as THREE from 'three';
import type { BuildingView, EntityId, PlayerView } from '../../shared';
import {
  buildingGeometry,
  buildingModel,
  constructionCoreGeometry,
  constructionSiteGeometry,
  meshFrom,
} from '../art/models';
import { resolveColor } from '../art/palette';
import { VoxelBuilder } from '../art/VoxelBuilder';
import { DATA } from '../data';
import { TEAM_OF } from './UnitRenderer';

const SITE_HEIGHT = 1.1;
/** Fixed camera yaw (CameraRig): progress bars face the screen. */
const CAMERA_YAW = Math.PI / 4;

interface Drawn {
  object: THREE.Object3D;
  constructed: boolean;
  core?: THREE.Mesh;
  barFill?: THREE.Mesh;
}

/** Finished-building mesh from config (or a plain block). Also used for the placement ghost. */
export function buildingMesh(type: string, w: number, h: number, team: 'blue' | 'red'): THREE.Mesh {
  const model = buildingModel(DATA.buildings[type]?.model ?? '');
  if (model) return meshFrom(buildingGeometry(model, team));
  const block = new VoxelBuilder()
    .box(0.1, 0, 0.1, w - 0.2, 0.9, h - 0.2, 'planks', resolveColor('team', team), { top: 'shingles' })
    .build();
  return meshFrom(block);
}

export class BuildingRenderer {
  readonly group = new THREE.Group();
  private readonly drawn = new Map<EntityId, Drawn>();
  private readonly flag: THREE.Group;
  private readonly outline: THREE.Group;
  private readonly raycaster = new THREE.Raycaster();
  private readonly siteCache = new Map<
    string,
    { site: THREE.BufferGeometry; core: THREE.BufferGeometry; mats: THREE.Material[][] }
  >();
  private outlineFor = -1;

  constructor() {
    this.group.name = 'buildings';
    this.flag = this.makeFlag();
    this.outline = new THREE.Group();
    this.group.add(this.flag, this.outline);
  }

  update(view: PlayerView, selected: ReadonlySet<EntityId>): void {
    const seen = new Set<EntityId>();
    let rallyShown = false;
    let outlined: BuildingView | null = null;
    for (const b of view.buildings) {
      seen.add(b.id);
      let d = this.drawn.get(b.id);
      if (!d || d.constructed !== b.constructed) {
        if (d) this.group.remove(d.object);
        d = b.constructed ? this.addFinished(b) : this.addSite(b);
        this.drawn.set(b.id, d);
      }
      if (!b.constructed && d.core && d.barFill) {
        d.core.scale.y = Math.max(0.04, b.buildProgress) * SITE_HEIGHT;
        d.barFill.scale.x = Math.max(0.001, b.buildProgress);
      }
      if (selected.has(b.id)) outlined = b;
      if (selected.has(b.id) && b.owner === view.player && b.rally) {
        this.flag.position.set(b.rally.x, 0, b.rally.y);
        rallyShown = true;
      }
    }
    for (const [id, d] of this.drawn) {
      if (seen.has(id)) continue;
      this.group.remove(d.object);
      this.drawn.delete(id);
    }
    this.flag.visible = rallyShown;
    this.showOutline(outlined, view.player);
  }

  /** Building under the given normalized device coordinates. */
  pick(ndcX: number, ndcY: number, camera: THREE.Camera): EntityId | null {
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
    const targets = [...this.drawn.values()].map((d) => d.object);
    const hits = this.raycaster.intersectObjects(targets, true);
    for (const hit of hits) {
      let o: THREE.Object3D | null = hit.object;
      while (o && o.userData.entityId === undefined) o = o.parent;
      if (o) return o.userData.entityId as EntityId;
    }
    return null;
  }

  private addFinished(b: BuildingView): Drawn {
    const mesh = buildingMesh(b.type, b.w, b.h, TEAM_OF[b.owner]);
    mesh.position.set(b.x, 0, b.y);
    mesh.userData.entityId = b.id;
    mesh.name = `building:${b.type}:${b.id}`;
    this.group.add(mesh);
    return { object: mesh, constructed: true };
  }

  /** The generic construction site, sized from the footprint. */
  private addSite(b: BuildingView): Drawn {
    const key = `${b.w}x${b.h}`;
    let cached = this.siteCache.get(key);
    if (!cached) {
      const site = constructionSiteGeometry(b.w, b.h, SITE_HEIGHT);
      const core = constructionCoreGeometry(b.w, b.h);
      cached = {
        site: site.geometry,
        core: core.geometry,
        mats: [site, core].map((g) => meshFrom(g).material as THREE.Material[]),
      };
      this.siteCache.set(key, cached);
    }
    const group = new THREE.Group();
    group.position.set(b.x, 0, b.y);
    group.userData.entityId = b.id;
    group.name = `site:${b.type}:${b.id}`;
    const site = new THREE.Mesh(cached.site, cached.mats[0]);
    const core = new THREE.Mesh(cached.core, cached.mats[1]);
    for (const m of [site, core]) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
    core.position.y = 0.08;
    group.add(site, core);

    // progress bar floating above the site, facing the camera
    const bar = new THREE.Group();
    bar.position.set(b.w / 2, SITE_HEIGHT + 0.7, b.h / 2);
    bar.rotation.y = CAMERA_YAW;
    const width = Math.max(1.2, Math.min(b.w, b.h) * 0.9);
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.08, 0.14, 0.04),
      new THREE.MeshBasicMaterial({ color: '#14111c' }),
    );
    const fillGeometry = new THREE.BoxGeometry(width, 0.08, 0.05).translate(width / 2, 0, 0);
    const fill = new THREE.Mesh(fillGeometry, new THREE.MeshBasicMaterial({ color: '#f5cf7a' }));
    fill.position.x = -width / 2;
    fill.position.z = 0.01;
    bar.add(back, fill);
    group.add(bar);

    this.group.add(group);
    return { object: group, constructed: false, core, barFill: fill };
  }

  /** Footprint outline around the selected building (green own, red enemy). */
  private showOutline(b: BuildingView | null, player: number): void {
    if (!b) {
      this.outline.visible = false;
      this.outlineFor = -1;
      return;
    }
    this.outline.visible = true;
    if (this.outlineFor === b.id) return;
    this.outlineFor = b.id;
    this.outline.clear();
    const material = new THREE.MeshBasicMaterial({ color: b.owner === player ? '#7dff6a' : '#ff6a5a' });
    const t = 0.07;
    const bar = (x: number, z: number, w: number, d: number): void => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, d), material);
      m.position.set(x + w / 2, 0.03, z + d / 2);
      this.outline.add(m);
    };
    bar(b.x - 0.05, b.y - 0.05, b.w + 0.1, t);
    bar(b.x - 0.05, b.y + b.h - 0.02, b.w + 0.1, t);
    bar(b.x - 0.05, b.y - 0.05, t, b.h + 0.1);
    bar(b.x + b.w - 0.02, b.y - 0.05, t, b.h + 0.1);
  }

  private makeFlag(): THREE.Group {
    const g = new THREE.Group();
    const built = new VoxelBuilder()
      .box(-0.03, 0, -0.03, 0.06, 0.9, 0.06, 'bark', '#5a3820')
      .box(0.03, 0.55, -0.015, 0.34, 0.24, 0.03, 'cloth', '#7dff6a')
      .build();
    g.add(meshFrom(built));
    g.visible = false;
    return g;
  }
}
