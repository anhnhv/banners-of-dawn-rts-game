/**
 * Draws buildings from the PlayerView. The model comes from the building config
 * (buildings.json → model); buildings without a model yet get a plain footprint block.
 * Also draws the rally flag of the selected building, and supports picking by ray.
 */
import * as THREE from 'three';
import type { BuildingView, EntityId, PlayerView } from '../../shared';
import { buildingGeometry, buildingModel, meshFrom } from '../art/models';
import { resolveColor } from '../art/palette';
import { VoxelBuilder } from '../art/VoxelBuilder';
import { DATA } from '../data';
import { TEAM_OF } from './UnitRenderer';

export class BuildingRenderer {
  readonly group = new THREE.Group();
  private readonly meshes = new Map<EntityId, THREE.Mesh>();
  private readonly flag: THREE.Group;
  private readonly outline: THREE.Group;
  private readonly raycaster = new THREE.Raycaster();

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
      if (!this.meshes.has(b.id)) this.add(b);
      if (selected.has(b.id)) outlined = b;
      if (selected.has(b.id) && b.owner === view.player && b.rally) {
        this.flag.position.set(b.rally.x, 0, b.rally.y);
        rallyShown = true;
      }
    }
    for (const [id, mesh] of this.meshes) {
      if (seen.has(id)) continue;
      this.group.remove(mesh);
      this.meshes.delete(id);
    }
    this.flag.visible = rallyShown;
    this.showOutline(outlined, view.player);
  }

  private outlineFor = -1;

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

  /** Building under the given normalized device coordinates. */
  pick(ndcX: number, ndcY: number, camera: THREE.Camera): EntityId | null {
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
    const hits = this.raycaster.intersectObjects([...this.meshes.values()], false);
    const id = hits[0]?.object.userData.entityId as EntityId | undefined;
    return id ?? null;
  }

  private add(b: BuildingView): void {
    const team = TEAM_OF[b.owner];
    const model = buildingModel(DATA.buildings[b.type]?.model ?? '');
    let mesh: THREE.Mesh;
    if (model) {
      mesh = meshFrom(buildingGeometry(model, team));
    } else {
      const block = new VoxelBuilder()
        .box(0.1, 0, 0.1, b.w - 0.2, 0.9, b.h - 0.2, 'planks', resolveColor('team', team), {
          top: 'shingles',
        })
        .build();
      mesh = meshFrom(block);
    }
    mesh.position.set(b.x, 0, b.y);
    mesh.userData.entityId = b.id;
    mesh.name = `building:${b.type}:${b.id}`;
    this.group.add(mesh);
    this.meshes.set(b.id, mesh);
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
