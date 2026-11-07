/**
 * Draws buildings from the PlayerView.
 * - Finished buildings use the model named in their config (buildings.json → model); buildings
 *   without a model yet get a plain footprint block.
 * - Construction sites use ONE generic look for every building type (scaffold + rising block +
 *   progress bar), generated from the footprint size.
 * - Damage: HP bar when damaged or selected, sparks on hits, fire and smoke below 50% HP.
 * - Destroyed buildings leave ONE generic rubble pile (sized from the footprint) with a dust
 *   cloud, for game.json → effects.rubbleSeconds.
 * Also draws the selection outline and the rally flag, and supports picking by ray.
 */
import * as THREE from 'three';
import type { BuildingView, EntityId, GameEvent, PlayerView } from '../../shared';
import {
  buildingGeometry,
  buildingModel,
  constructionCoreGeometry,
  constructionSiteGeometry,
  meshFrom,
  rubbleGeometry,
} from '../art/models';
import { resolveColor } from '../art/palette';
import { VoxelBuilder } from '../art/VoxelBuilder';
import { DATA } from '../data';
import type { Effects } from './Effects';
import type { HealthBars } from './HealthBars';
import { TEAM_OF } from './UnitRenderer';

const SITE_HEIGHT = 1.1;
/** Fixed camera yaw (CameraRig): progress bars face the screen. */
const CAMERA_YAW = Math.PI / 4;

interface Drawn {
  object: THREE.Object3D;
  constructed: boolean;
  /** Height of the model's top (HP bar, fire). */
  top: number;
  lastHp: number;
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
  private readonly rubble: Array<{ mesh: THREE.Mesh; age: number }> = [];

  constructor(
    private readonly effects: Effects,
    private readonly bars: HealthBars,
  ) {
    this.group.name = 'buildings';
    this.flag = this.makeFlag();
    this.outline = new THREE.Group();
    this.group.add(this.flag, this.outline);
  }

  /** Destroyed buildings leave rubble and a dust cloud. */
  onEvents(events: readonly GameEvent[]): void {
    for (const e of events) {
      if (e.type !== 'buildingDestroyed') continue;
      const mesh = meshFrom(rubbleGeometry(e.w, e.h));
      mesh.position.set(e.x, 0, e.y);
      this.group.add(mesh);
      this.rubble.push({ mesh, age: 0 });
      this.effects.dust(e.x + e.w / 2, e.y + e.h / 2, Math.max(e.w, e.h) * 0.6, 24 + e.w * e.h * 3);
    }
  }

  update(view: PlayerView, selected: ReadonlySet<EntityId>, dt: number): void {
    this.updateRubble(dt);
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
      if (b.hp < d.lastHp) this.effects.sparks(b.x + b.w / 2, d.top * 0.6, b.y + b.h / 2, 5);
      d.lastHp = b.hp;
      const frac = b.hp / b.maxHp;
      if (b.constructed && frac < 0.5) {
        // burning: flames on two spots of the roof, stronger the lower the HP
        const intensity = 1 + (0.5 - frac) * 4;
        this.effects.fire(b.x + b.w * 0.35, d.top * 0.85, b.y + b.h * 0.4, dt, intensity);
        if (b.w * b.h > 1) this.effects.fire(b.x + b.w * 0.65, d.top * 0.7, b.y + b.h * 0.65, dt, intensity);
      }
      if (selected.has(b.id) || b.hp < b.maxHp) {
        this.bars.add(
          b.x + b.w / 2,
          d.top + 0.3,
          b.y + b.h / 2,
          Math.min(2.2, Math.max(0.8, b.w * 0.6)),
          frac,
        );
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
    return { object: mesh, constructed: true, top: topOf(mesh), lastHp: b.hp };
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
    return { object: group, constructed: false, top: SITE_HEIGHT, lastHp: b.hp, core, barFill: fill };
  }

  private updateRubble(dt: number): void {
    const stay = DATA.game.effects.rubbleSeconds;
    for (let i = this.rubble.length - 1; i >= 0; i--) {
      const r = this.rubble[i] as { mesh: THREE.Mesh; age: number };
      r.age += dt;
      r.mesh.position.y = -Math.max(0, r.age - (stay - 2)) * 0.15;
      if (r.age >= stay) {
        this.group.remove(r.mesh);
        r.mesh.geometry.dispose();
        this.rubble.splice(i, 1);
      }
    }
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

function topOf(o: THREE.Object3D): number {
  return new THREE.Box3().setFromObject(o).max.y;
}
