/**
 * Draws all units from the PlayerView (PLAN §7.4):
 * - one InstancedMesh per (unit type, team) for the body, plus one per leg, so hundreds of units
 *   cost a few dozen draw calls;
 * - positions interpolated between ticks, facing smoothed, legs swing with distance walked;
 * - x-ray silhouettes: units hidden behind buildings/trees show as a team-colored ghost;
 * - selection rings under selected units.
 */
import * as THREE from 'three';
import type { EntityId, PlayerId, PlayerView, UnitTypeId } from '../../shared';
import { unitModel, unitParts, type UnitModel, type UnitPartGeometry } from '../art/models';
import { VoxelBuilder } from '../art/VoxelBuilder';
import { DATA } from '../data';
import { resolveColor, type TeamName } from '../art/palette';
import { voxelMaterial } from '../art/materials';

/** Color of the bundle a unit carries on its back, per resource type. */
const CARRY_COLOR: Record<string, string> = { food: '#d9413a', wood: '#8a5a32', gold: '#f6c945' };

export const TEAM_OF: Record<PlayerId, TeamName> = { 0: 'blue', 1: 'red' };

/** Interpolated state of a unit this frame (used for picking). */
export interface UnitScreenState {
  id: EntityId;
  owner: PlayerId;
  type: UnitTypeId;
  x: number;
  z: number;
  radius: number;
}

interface Anim {
  facing: number;
  phase: number;
  swing: number;
  lastX: number;
  lastZ: number;
}

const tmpMatrix = new THREE.Matrix4();
const tmpLeg = new THREE.Matrix4();
const tmpPos = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpScale = new THREE.Vector3(1, 1, 1);
const UP = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const tmpLean = new THREE.Matrix4();
const tmpColor = new THREE.Color();

/** All instanced meshes for one unit type of one team. */
class UnitBatch {
  capacity = 0;
  count = 0;
  body!: THREE.InstancedMesh;
  silhouette!: THREE.InstancedMesh;
  /** All legs of all units of this batch in ONE mesh (every leg of a unit type has the same shape). */
  legs!: THREE.InstancedMesh;
  private readonly parts: UnitPartGeometry;
  private readonly silhouetteMaterial: THREE.MeshBasicMaterial;

  constructor(
    private readonly parent: THREE.Group,
    model: UnitModel,
    team: TeamName,
  ) {
    this.parts = unitParts(model, team);
    // X-ray pass: drawn after the world but BEFORE the units (renderOrder 1 vs 2), with an inverted
    // depth test, so it only shows where terrain, trees or buildings hide a unit. The units, drawn
    // next, cover it wherever they are actually visible.
    this.silhouetteMaterial = new THREE.MeshBasicMaterial({
      color: resolveColor('team-light', team),
      depthWrite: false,
      depthFunc: THREE.GreaterDepth,
    });
    this.allocate(32);
  }

  get pivots(): ReadonlyArray<[number, number, number]> {
    return this.parts.legs.map((l) => l.pivot);
  }

  get legsPerUnit(): number {
    return this.parts.legs.length;
  }

  ensure(n: number): void {
    if (n <= this.capacity) return;
    let cap = this.capacity;
    while (cap < n) cap *= 2;
    this.dispose();
    this.allocate(cap);
  }

  finish(): void {
    this.body.count = this.count;
    this.silhouette.count = this.count;
    this.body.instanceMatrix.needsUpdate = true;
    this.legs.count = this.count * this.legsPerUnit;
    this.legs.instanceMatrix.needsUpdate = true;
  }

  private allocate(capacity: number): void {
    this.capacity = capacity;
    const mk = (
      geometry: THREE.BufferGeometry,
      materials: THREE.Material | THREE.Material[],
      instances = capacity,
    ): THREE.InstancedMesh => {
      const m = new THREE.InstancedMesh(geometry, materials, instances);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.count = 0;
      m.frustumCulled = false;
      this.parent.add(m);
      return m;
    };
    this.body = mk(
      this.parts.body.geometry,
      this.parts.body.textures.map((t) => voxelMaterial(t)),
    );
    this.body.castShadow = true;
    this.body.receiveShadow = true;
    this.body.renderOrder = 2;
    this.silhouette = mk(this.parts.body.geometry, this.silhouetteMaterial);
    this.silhouette.instanceMatrix = this.body.instanceMatrix; // same transforms as the body
    this.silhouette.renderOrder = 1;
    const leg = this.parts.legs[0]?.geometry ?? this.parts.body;
    this.legs = mk(
      leg.geometry,
      leg.textures.map((t) => voxelMaterial(t)),
      capacity * Math.max(1, this.legsPerUnit),
    );
    this.legs.castShadow = true;
    this.legs.renderOrder = 2;
  }

  private dispose(): void {
    for (const m of [this.body, this.silhouette, this.legs]) {
      this.parent.remove(m);
      m.dispose();
    }
  }
}

export class UnitRenderer {
  readonly group = new THREE.Group();
  /** Interpolated unit states of the last frame, for picking and selection. */
  readonly states: UnitScreenState[] = [];
  private readonly batches = new Map<string, UnitBatch>();
  private readonly anim = new Map<EntityId, Anim>();
  private rings: THREE.InstancedMesh;
  private ringCapacity = 64;
  private carries: THREE.InstancedMesh;
  private carryCapacity = 64;
  private time = 0;

  constructor() {
    this.group.name = 'units';
    this.rings = this.makeRings(this.ringCapacity);
    this.carries = this.makeCarries(this.carryCapacity);
  }

  update(view: PlayerView, alpha: number, dt: number, selected: ReadonlySet<EntityId>): void {
    this.time += dt;
    for (const b of this.batches.values()) b.count = 0;
    let carryCount = 0;
    const carriers = view.units.reduce((n, u) => n + (u.carry && u.carry.amount > 0 ? 1 : 0), 0);
    if (carriers > this.carryCapacity) {
      while (this.carryCapacity < carriers) this.carryCapacity *= 2;
      this.group.remove(this.carries);
      this.carries.dispose();
      this.carries = this.makeCarries(this.carryCapacity);
    }
    this.states.length = 0;
    const seen = new Set<EntityId>();
    let ringCount = 0;
    if (selected.size > this.ringCapacity) {
      while (this.ringCapacity < selected.size) this.ringCapacity *= 2;
      this.group.remove(this.rings);
      this.rings.dispose();
      this.rings = this.makeRings(this.ringCapacity);
    }
    // Size every batch first, so growing a batch never drops matrices written this frame.
    const counts = new Map<UnitBatch, number>();
    for (const u of view.units) {
      const b = this.batch(u.type, u.owner);
      counts.set(b, (counts.get(b) ?? 0) + 1);
    }
    for (const [b, n] of counts) b.ensure(n);

    for (const u of view.units) {
      seen.add(u.id);
      const x = u.prevX + (u.x - u.prevX) * alpha;
      const z = u.prevY + (u.y - u.prevY) * alpha;
      this.states.push({ id: u.id, owner: u.owner, type: u.type, x, z, radius: u.radius });

      let a = this.anim.get(u.id);
      if (!a) {
        a = { facing: u.facing, phase: 0, swing: 0, lastX: x, lastZ: z };
        this.anim.set(u.id, a);
      }
      const moved = Math.hypot(x - a.lastX, z - a.lastZ);
      a.lastX = x;
      a.lastZ = z;
      a.facing = approachAngle(a.facing, u.facing, Math.min(1, dt * 12));
      a.phase += moved * 9;
      a.swing += ((u.moving ? 0.7 : 0) - a.swing) * Math.min(1, dt * 10);

      const batch = this.batch(u.type, u.owner);
      const i = batch.count++;
      const bob = u.moving ? Math.abs(Math.sin(a.phase)) * 0.025 : 0;
      tmpPos.set(x, bob, z);
      tmpQuat.setFromAxisAngle(UP, a.facing);
      tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
      if (u.activity === 'work') {
        // the one shared "interacting" animation: a rhythmic lean into the work
        const beat = Math.max(0, Math.sin(this.time * 7 + u.id * 1.7));
        tmpLean.makeRotationAxis(X_AXIS, beat * beat * 0.32);
        tmpMatrix.multiply(tmpLean);
      }
      batch.body.setMatrixAt(i, tmpMatrix);
      batch.pivots.forEach((pivot, li) => {
        // people: left/right alternate; horses: diagonal pairs move together
        const n = batch.legsPerUnit;
        const sign = n === 4 ? (li === 0 || li === 3 ? 1 : -1) : li % 2 === 0 ? 1 : -1;
        tmpLeg.makeRotationAxis(X_AXIS, Math.sin(a.phase) * a.swing * sign);
        tmpLeg.setPosition(pivot[0], pivot[1], pivot[2]);
        batch.legs.setMatrixAt(i * n + li, tmpLeg.premultiply(tmpMatrix));
      });

      if (u.carry && u.carry.amount > 0) {
        tmpLeg.makeTranslation(0, 0.34, -0.14);
        this.carries.setMatrixAt(carryCount, tmpLeg.premultiply(tmpMatrix));
        this.carries.setColorAt(carryCount, tmpColor.set(CARRY_COLOR[u.carry.resource] ?? '#ffffff'));
        carryCount++;
      }

      if (selected.has(u.id)) {
        const s = u.radius / 0.28;
        tmpPos.set(x, 0.025, z);
        tmpMatrix.compose(tmpPos, tmpQuat.identity(), new THREE.Vector3(s, 1, s));
        this.rings.setMatrixAt(ringCount++, tmpMatrix);
      }
    }

    for (const b of this.batches.values()) b.finish();
    this.rings.count = ringCount;
    this.rings.instanceMatrix.needsUpdate = true;
    this.carries.count = carryCount;
    this.carries.instanceMatrix.needsUpdate = true;
    if (this.carries.instanceColor) this.carries.instanceColor.needsUpdate = true;
    for (const id of this.anim.keys()) if (!seen.has(id)) this.anim.delete(id);
  }

  private batch(type: UnitTypeId, owner: PlayerId): UnitBatch {
    const key = `${type}:${owner}`;
    let b = this.batches.get(key);
    if (!b) {
      b = new UnitBatch(this.group, unitModel(DATA.units[type]?.model ?? ''), TEAM_OF[owner]);
      this.batches.set(key, b);
    }
    return b;
  }

  private makeCarries(capacity: number): THREE.InstancedMesh {
    const built = new VoxelBuilder().boxC(0, -0.07, 0, 0.15, 0.14, 0.1, 'planks', '#ffffff').build();
    const mesh = new THREE.InstancedMesh(
      built.geometry,
      built.textures.map((t) => voxelMaterial(t)),
      capacity,
    );
    mesh.setColorAt(0, tmpColor.set('#ffffff'));
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.renderOrder = 2;
    this.group.add(mesh);
    return mesh;
  }

  private makeRings(capacity: number): THREE.InstancedMesh {
    const geometry = new THREE.RingGeometry(0.27, 0.34, 24).rotateX(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({
      color: '#7dff6a',
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const rings = new THREE.InstancedMesh(geometry, material, capacity);
    rings.count = 0;
    rings.frustumCulled = false;
    rings.renderOrder = 2;
    this.group.add(rings);
    return rings;
  }
}

/** Move angle `from` toward `to` by fraction t along the shortest way round. */
function approachAngle(from: number, to: number, t: number): number {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return from + d * t;
}
