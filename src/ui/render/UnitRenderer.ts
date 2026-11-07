/**
 * Draws all units from the PlayerView (PLAN §7.4):
 * - per (unit type, team): one InstancedMesh for the body, one for all legs, one per arm side,
 *   so hundreds of units cost a few dozen draw calls;
 * - positions interpolated between ticks, facing smoothed;
 * - animation (one set for every unit, no per-type code):
 *     walk: legs and arms swing in opposite rhythm, small bob
 *     work: the shared "interacting" animation — the body sways gently from side to side and the
 *           arms swing (a tool held in the right arm swings with it)
 * - x-ray silhouettes for units hidden behind buildings/trees; selection rings.
 */
import * as THREE from 'three';
import type { EntityId, PlayerId, PlayerView, UnitTypeId } from '../../shared';
import { unitModel, unitParts, type UnitModel, type UnitPartGeometry } from '../art/models';
import { resolveColor, type TeamName } from '../art/palette';
import { voxelMaterial } from '../art/materials';
import type { TexKey } from '../art/textures';
import { DATA } from '../data';

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
  walk: number;
  work: number;
  lastX: number;
  lastZ: number;
}

const tmpMatrix = new THREE.Matrix4();
const tmpPart = new THREE.Matrix4();
const tmpSway = new THREE.Matrix4();
const tmpPos = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpScale = new THREE.Vector3(1, 1, 1);
const UP = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

const mats = (textures: TexKey[]): THREE.Material[] => textures.map((t) => voxelMaterial(t));

/** All instanced meshes for one unit type of one team. */
class UnitBatch {
  capacity = 0;
  count = 0;
  body!: THREE.InstancedMesh;
  silhouette!: THREE.InstancedMesh;
  /** All legs of all units of this batch in ONE mesh (every leg of a unit type has the same shape). */
  legs!: THREE.InstancedMesh;
  /** Left and right arms (people only). */
  arms: THREE.InstancedMesh[] = [];
  readonly parts: UnitPartGeometry;
  private readonly silhouetteMaterial: THREE.MeshBasicMaterial;

  constructor(
    private readonly parent: THREE.Group,
    model: UnitModel,
    team: TeamName,
  ) {
    this.parts = unitParts(model, team);
    // X-ray pass: drawn after the world but BEFORE the units (renderOrder 1 vs 2), with an inverted
    // depth test, so it only shows where terrain, trees or buildings hide a unit.
    this.silhouetteMaterial = new THREE.MeshBasicMaterial({
      color: resolveColor('team-light', team),
      depthWrite: false,
      depthFunc: THREE.GreaterDepth,
    });
    this.allocate(32);
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
    for (const a of this.arms) {
      a.count = this.count;
      a.instanceMatrix.needsUpdate = true;
    }
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
      m.castShadow = true;
      m.renderOrder = 2;
      this.parent.add(m);
      return m;
    };
    this.body = mk(this.parts.body.geometry, mats(this.parts.body.textures));
    this.body.receiveShadow = true;
    this.silhouette = mk(this.parts.body.geometry, this.silhouetteMaterial);
    this.silhouette.instanceMatrix = this.body.instanceMatrix; // same transforms as the body
    this.silhouette.renderOrder = 1;
    this.silhouette.castShadow = false;
    const leg = this.parts.legs[0]?.geometry ?? this.parts.body;
    this.legs = mk(leg.geometry, mats(leg.textures), capacity * Math.max(1, this.legsPerUnit));
    this.arms = this.parts.arms.map((a) => mk(a.geometry.geometry, mats(a.geometry.textures)));
  }

  private dispose(): void {
    for (const m of [this.body, this.silhouette, this.legs, ...this.arms]) {
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
  private time = 0;

  constructor() {
    this.group.name = 'units';
    this.rings = this.makeRings(this.ringCapacity);
  }

  update(view: PlayerView, alpha: number, dt: number, selected: ReadonlySet<EntityId>): void {
    this.time += dt;
    for (const b of this.batches.values()) b.count = 0;
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

    const ease = Math.min(1, dt * 10);
    for (const u of view.units) {
      seen.add(u.id);
      const x = u.prevX + (u.x - u.prevX) * alpha;
      const z = u.prevY + (u.y - u.prevY) * alpha;
      this.states.push({ id: u.id, owner: u.owner, type: u.type, x, z, radius: u.radius });

      let a = this.anim.get(u.id);
      if (!a) {
        a = { facing: u.facing, phase: 0, walk: 0, work: 0, lastX: x, lastZ: z };
        this.anim.set(u.id, a);
      }
      const moved = Math.hypot(x - a.lastX, z - a.lastZ);
      a.lastX = x;
      a.lastZ = z;
      a.facing = approachAngle(a.facing, u.facing, Math.min(1, dt * 12));
      a.phase += moved * 9;
      // blend weights so switching between walking and working never pops
      a.walk += ((u.activity === 'walk' ? 1 : 0) - a.walk) * ease;
      a.work += ((u.activity === 'work' ? 1 : 0) - a.work) * ease;

      const batch = this.batch(u.type, u.owner);
      const i = batch.count++;
      const bob = Math.abs(Math.sin(a.phase)) * 0.025 * a.walk;
      tmpPos.set(x, bob, z);
      tmpQuat.setFromAxisAngle(UP, a.facing);
      tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);

      // shared work animation: gentle side-to-side sway (roll around the forward axis)
      const beat = this.time * 5 + u.id * 1.7;
      if (a.work > 0.01) {
        tmpSway.makeRotationAxis(Z_AXIS, Math.sin(beat) * 0.09 * a.work);
        tmpMatrix.multiply(tmpSway);
      }
      batch.body.setMatrixAt(i, tmpMatrix);

      const legSwing = Math.sin(a.phase) * 0.7 * a.walk;
      const n = batch.legsPerUnit;
      batch.parts.legs.forEach((leg, li) => {
        // people: left/right alternate; horses: diagonal pairs move together
        const sign = n === 4 ? (li === 0 || li === 3 ? 1 : -1) : li % 2 === 0 ? 1 : -1;
        tmpPart.makeRotationAxis(X_AXIS, legSwing * sign);
        tmpPart.setPosition(leg.pivot[0], leg.pivot[1], leg.pivot[2]);
        batch.legs.setMatrixAt(i * n + li, tmpPart.premultiply(tmpMatrix));
      });

      batch.parts.arms.forEach((arm, side) => {
        const sign = side === 0 ? 1 : -1;
        // walking: arms opposite to the legs; working: arms swing back and forth with the sway
        const swing = -legSwing * 0.8 * sign + Math.sin(beat * 2 + side * Math.PI) * 0.55 * a.work;
        tmpPart.makeRotationAxis(X_AXIS, -swing);
        tmpPart.setPosition(arm.pivot[0], arm.pivot[1], arm.pivot[2]);
        batch.arms[side]?.setMatrixAt(i, tmpPart.premultiply(tmpMatrix));
      });

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
