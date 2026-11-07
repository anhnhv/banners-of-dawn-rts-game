/**
 * Placing a building from the build menu (PLAN §9.2b, M4). No workers are involved:
 *  - a translucent ghost of the finished building follows the cursor, centered on it;
 *  - each footprint tile is tinted green (buildable) or red (blocked); the whole ghost turns red
 *    when the player cannot afford it;
 *  - left click sends `build {building, at}` (Shift keeps placing more), right click or Esc cancels.
 * The engine re-checks everything; this is only a preview.
 */
import * as THREE from 'three';
import type { Command, PlayerId } from '../../shared';
import { DATA } from '../data';
import { buildingMesh } from '../render/BuildingRenderer';
import { TEAM_OF } from '../render/UnitRenderer';

export interface PlacementOptions {
  player: PlayerId;
  /** True if a building may stand on this tile (terrain buildable and nothing on it). */
  tileFree: (x: number, y: number) => boolean;
  canAfford: (building: string) => boolean;
  onCommand: (cmd: Command) => void;
  /** Called when placement starts or ends. */
  onChange: (active: boolean) => void;
}

export class PlacementController {
  readonly object = new THREE.Group();
  private type: string | null = null;
  private ghost: THREE.Mesh | null = null;
  private ghostMaterials: THREE.Material[] = [];
  private tiles: THREE.Mesh[] = [];
  private at: { x: number; y: number } | null = null;
  private valid = false;
  private readonly okMat = new THREE.MeshBasicMaterial({
    color: '#6dff6a',
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
    depthTest: false, // stays visible over buildings and trees, so a blocked spot always shows red
  });
  private readonly badMat = new THREE.MeshBasicMaterial({
    color: '#ff4a4a',
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    depthTest: false,
  });
  private readonly tileGeometry = new THREE.PlaneGeometry(0.94, 0.94).rotateX(-Math.PI / 2);

  constructor(private readonly o: PlacementOptions) {
    this.object.name = 'placement';
    this.object.visible = false;
    this.object.renderOrder = 3;
  }

  get active(): boolean {
    return this.type !== null;
  }

  begin(type: string): void {
    const def = DATA.buildings[type];
    if (!def) return;
    this.clear();
    this.type = type;
    const [w, h] = def.footprint;
    const ghost = buildingMesh(type, w, h, TEAM_OF[this.o.player]);
    // own translucent copies: the voxel materials are shared with the real buildings
    const source = Array.isArray(ghost.material) ? ghost.material : [ghost.material];
    this.ghostMaterials = source.map((m) => {
      const c = m.clone();
      c.transparent = true;
      c.opacity = 0.6;
      c.depthWrite = false;
      return c;
    });
    ghost.material = this.ghostMaterials;
    ghost.castShadow = false;
    ghost.receiveShadow = false;
    ghost.renderOrder = 4;
    this.ghost = ghost;
    this.object.add(ghost);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const tile = new THREE.Mesh(this.tileGeometry, this.okMat);
        tile.position.set(x + 0.5, 0.04, y + 0.5);
        tile.renderOrder = 5;
        this.tiles.push(tile);
        this.object.add(tile);
      }
    }
    this.at = null;
    this.o.onChange(true);
  }

  cancel(): void {
    if (!this.active) return;
    this.clear();
    this.o.onChange(false);
  }

  /** Follow the cursor (ground point, or null when off the map). Call every frame while active. */
  update(ground: { x: number; z: number } | null): void {
    if (!this.type) return;
    const def = DATA.buildings[this.type];
    if (!def || !ground) {
      this.object.visible = false;
      this.at = null;
      return;
    }
    const [w, h] = def.footprint;
    const x = Math.floor(ground.x - w / 2 + 0.5);
    const y = Math.floor(ground.z - h / 2 + 0.5);
    this.at = { x, y };
    this.object.visible = true;
    this.object.position.set(x, 0, y);
    const afford = this.o.canAfford(this.type);
    let ok = true;
    this.tiles.forEach((tile, i) => {
      const free = this.o.tileFree(x + (i % w), y + Math.floor(i / w));
      tile.material = free && afford ? this.okMat : this.badMat;
      ok &&= free;
    });
    this.valid = ok && afford;
    for (const m of this.ghostMaterials) {
      const c = (m as THREE.MeshLambertMaterial).color;
      if (c) c.set(this.valid ? '#ffffff' : '#ff8a8a');
    }
  }

  /** Left click: place here. Keeps placing while Shift is held. */
  place(shift: boolean): void {
    if (!this.type || !this.at) return;
    // an invalid spot is still sent: the engine rejects it and the HUD shows why
    this.o.onCommand({ type: 'build', building: this.type, at: { ...this.at } });
    if (this.valid && !shift) this.cancel();
  }

  private clear(): void {
    if (this.ghost) this.object.remove(this.ghost);
    for (const m of this.ghostMaterials) m.dispose();
    for (const t of this.tiles) this.object.remove(t);
    this.ghost = null;
    this.ghostMaterials = [];
    this.tiles = [];
    this.type = null;
    this.at = null;
    this.object.visible = false;
  }
}
