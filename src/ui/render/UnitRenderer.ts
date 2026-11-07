/**
 * Draws all units from the PlayerView (PLAN §7.4, §7.9):
 * - per (unit type, team): one InstancedMesh for the body, one for all legs, one per arm side,
 *   so hundreds of units cost a few dozen draw calls;
 * - positions interpolated between ticks, facing smoothed;
 * - animation (ONE set for every unit, no per-type code):
 *     walk:   legs and arms swing in opposite rhythm, small bob
 *     work:   the shared "interacting" animation — gentle side-to-side sway, arms swing
 *     attack: the shared strike — right arm chops down, left arm comes forward, body lunges
 *             (units without arms, e.g. riders, only lunge); timed from UnitView.strikeTick
 * - hit flash (white overlay) and sparks when HP drops; HP bars when damaged or selected;
 * - corpses: a dead unit topples sideways, lies for game.json → effects.corpseSeconds, then sinks;
 * - x-ray silhouettes for units hidden behind buildings/trees; selection rings (green own, red enemy).
 */
import * as THREE from 'three';
import {
  TICK_RATE,
  type EntityId,
  type GameEvent,
  type PlayerId,
  type PlayerView,
  type UnitTypeId,
} from '../../shared';
import { voxelMaterial } from '../art/materials';
import {
  meshFrom,
  unitModel,
  unitParts,
  type LegPart,
  type UnitModel,
  type UnitPartGeometry,
} from '../art/models';
import { resolveColor, type TeamName } from '../art/palette';
import type { TexKey } from '../art/textures';
import { DATA } from '../data';
import type { Effects } from './Effects';
import type { HealthBars } from './HealthBars';

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
  fight: number;
  lastX: number;
  lastZ: number;
  lastHp: number;
  /** Seconds of hit flash left. */
  flash: number;
}

interface Corpse {
  group: THREE.Group;
  age: number;
}

const STRIKE_SECONDS = 0.38;
const FLASH_SECONDS = 0.14;

const tmpMatrix = new THREE.Matrix4();
const tmpPart = new THREE.Matrix4();
const tmpRot = new THREE.Matrix4();
const tmpPos = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpScale = new THREE.Vector3(1, 1, 1);
const tmpColor = new THREE.Color();
const FLASH_SCALE = new THREE.Matrix4().makeScale(1.07, 1.05, 1.07);
const UP = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const RING_OWN = new THREE.Color('#7dff6a');
const RING_ENEMY = new THREE.Color('#ff5a4a');

const mats = (textures: TexKey[]): THREE.Material[] => textures.map((t) => voxelMaterial(t));

/** All instanced meshes for one unit type of one team. */
class UnitBatch {
  capacity = 0;
  count = 0;
  flashCount = 0;
  body!: THREE.InstancedMesh;
  silhouette!: THREE.InstancedMesh;
  /** White overlay for units that were just hit. */
  flash!: THREE.InstancedMesh;
  /** All legs of all units of this batch in ONE mesh (every leg of a unit type has the same shape). */
  legs!: THREE.InstancedMesh;
  /** Left and right arms (people only). */
  arms: THREE.InstancedMesh[] = [];
  readonly parts: UnitPartGeometry;
  /** Height of the model's top, for HP bars. */
  readonly top: number;
  private readonly silhouetteMaterial: THREE.MeshBasicMaterial;
  private readonly flashMaterial = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  constructor(
    private readonly parent: THREE.Group,
    model: UnitModel,
    readonly team: TeamName,
  ) {
    this.parts = unitParts(model, team);
    this.parts.body.geometry.computeBoundingBox();
    this.top = this.parts.body.geometry.boundingBox?.max.y ?? 0.8;
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
    this.flash.count = this.flashCount;
    this.flash.instanceMatrix.needsUpdate = true;
    this.legs.count = this.count * this.legsPerUnit;
    this.legs.instanceMatrix.needsUpdate = true;
    for (const a of this.arms) {
      a.count = this.count;
      a.instanceMatrix.needsUpdate = true;
    }
  }

  /** A static copy of the model (for corpses), sharing geometry and materials. */
  statue(): THREE.Group {
    const g = new THREE.Group();
    const part = (l: LegPart): THREE.Mesh => {
      const m = meshFrom(l.geometry);
      m.position.set(...l.pivot);
      return m;
    };
    g.add(meshFrom(this.parts.body), ...this.parts.legs.map(part), ...this.parts.arms.map(part));
    return g;
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
    this.flash = mk(this.parts.body.geometry, this.flashMaterial);
    this.flash.renderOrder = 3;
    this.flash.castShadow = false;
    const leg = this.parts.legs[0]?.geometry ?? this.parts.body;
    this.legs = mk(leg.geometry, mats(leg.textures), capacity * Math.max(1, this.legsPerUnit));
    this.arms = this.parts.arms.map((a) => mk(a.geometry.geometry, mats(a.geometry.textures)));
  }

  private dispose(): void {
    for (const m of [this.body, this.silhouette, this.flash, this.legs, ...this.arms]) {
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
  private readonly corpses: Corpse[] = [];
  private rings: THREE.InstancedMesh;
  private ringCapacity = 64;
  private time = 0;

  constructor(
    private readonly effects: Effects,
    private readonly bars: HealthBars,
  ) {
    this.group.name = 'units';
    this.rings = this.makeRings(this.ringCapacity);
  }

  /** React to engine events (deaths leave a corpse). */
  onEvents(events: readonly GameEvent[]): void {
    for (const e of events) {
      if (e.type !== 'unitDied') continue;
      const statue = this.batch(e.unitType, e.owner).statue();
      const group = new THREE.Group();
      group.position.set(e.x, 0, e.y);
      group.rotation.y = this.anim.get(e.unit)?.facing ?? e.facing;
      group.add(statue);
      this.group.add(group);
      this.corpses.push({ group, age: 0 });
      this.effects.dust(e.x, e.y, 0.3, 6);
    }
  }

  update(view: PlayerView, alpha: number, dt: number, selected: ReadonlySet<EntityId>): void {
    this.time += dt;
    this.updateCorpses(dt);
    for (const b of this.batches.values()) {
      b.count = 0;
      b.flashCount = 0;
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

    const ease = Math.min(1, dt * 10);
    // the view is one tick ahead of the interpolated picture
    const nowTicks = view.tick - 1 + alpha;
    for (const u of view.units) {
      seen.add(u.id);
      const x = u.prevX + (u.x - u.prevX) * alpha;
      const z = u.prevY + (u.y - u.prevY) * alpha;
      this.states.push({ id: u.id, owner: u.owner, type: u.type, x, z, radius: u.radius });

      let a = this.anim.get(u.id);
      if (!a) {
        a = {
          facing: u.facing,
          phase: 0,
          walk: 0,
          work: 0,
          fight: 0,
          lastX: x,
          lastZ: z,
          lastHp: u.hp,
          flash: 0,
        };
        this.anim.set(u.id, a);
      }
      const moved = Math.hypot(x - a.lastX, z - a.lastZ);
      a.lastX = x;
      a.lastZ = z;
      a.facing = approachAngle(a.facing, u.facing, Math.min(1, dt * 12));
      a.phase += moved * 9;
      // blend weights so switching between walking, working and fighting never pops
      a.walk += ((u.activity === 'walk' ? 1 : 0) - a.walk) * ease;
      a.work += ((u.activity === 'work' ? 1 : 0) - a.work) * ease;
      a.fight += ((u.activity === 'attack' ? 1 : 0) - a.fight) * ease;
      const batch = this.batch(u.type, u.owner);
      if (u.hp < a.lastHp) {
        a.flash = FLASH_SECONDS;
        this.effects.sparks(x, batch.top * 0.6, z);
      }
      a.lastHp = u.hp;
      a.flash = Math.max(0, a.flash - dt);

      // strike: 0..1 over STRIKE_SECONDS after the strike tick (0 when not striking)
      const age = u.strikeTick >= 0 ? (nowTicks - u.strikeTick) / TICK_RATE : Infinity;
      const strike = age >= 0 && age < STRIKE_SECONDS ? age / STRIKE_SECONDS : -1;
      const chop = strike >= 0 ? Math.pow(1 - strike, 1.6) : 0; // 1 = arm raised, 0 = swung down
      const lunge = strike >= 0 ? Math.sin(Math.PI * strike) : 0;

      const i = batch.count++;
      const bob = Math.abs(Math.sin(a.phase)) * 0.025 * a.walk;
      tmpPos.set(x, bob, z);
      tmpQuat.setFromAxisAngle(UP, a.facing);
      tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);

      const beat = this.time * 5 + u.id * 1.7;
      if (a.work > 0.01) {
        // shared work animation: gentle side-to-side sway (roll around the forward axis)
        tmpRot.makeRotationAxis(Z_AXIS, Math.sin(beat) * 0.09 * a.work);
        tmpMatrix.multiply(tmpRot);
      }
      if (lunge > 0) {
        // shared strike: lean into the blow (pitch forward around the feet)
        tmpRot.makeRotationAxis(X_AXIS, lunge * (batch.parts.arms.length > 0 ? 0.14 : 0.2));
        tmpMatrix.multiply(tmpRot);
      }
      batch.body.setMatrixAt(i, tmpMatrix);
      if (a.flash > 0)
        batch.flash.setMatrixAt(batch.flashCount++, tmpPart.multiplyMatrices(tmpMatrix, FLASH_SCALE));

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
        // walking: arms opposite to the legs; working: arms swing with the sway;
        // fighting: arms held ready, and on a strike the right arm chops and the left comes forward
        let swing = -legSwing * 0.8 * sign + Math.sin(beat * 2 + side * Math.PI) * 0.55 * a.work;
        swing += a.fight * (side === 1 ? 0.5 : 0.35);
        if (strike >= 0) swing += side === 1 ? chop * 2.1 : lunge * 0.9;
        tmpPart.makeRotationAxis(X_AXIS, -swing);
        tmpPart.setPosition(arm.pivot[0], arm.pivot[1], arm.pivot[2]);
        batch.arms[side]?.setMatrixAt(i, tmpPart.premultiply(tmpMatrix));
      });

      const isSelected = selected.has(u.id);
      if (isSelected) {
        const s = u.radius / 0.28;
        tmpPos.set(x, 0.025, z);
        tmpMatrix.compose(tmpPos, tmpQuat.identity(), new THREE.Vector3(s, 1, s));
        this.rings.setMatrixAt(ringCount, tmpMatrix);
        this.rings.setColorAt(ringCount, u.owner === view.player ? RING_OWN : RING_ENEMY);
        ringCount++;
      }
      if (isSelected || u.hp < u.maxHp) {
        this.bars.add(x, batch.top + 0.16, z, Math.max(0.42, u.radius * 2), u.hp / u.maxHp);
      }
    }

    for (const b of this.batches.values()) b.finish();
    this.rings.count = ringCount;
    this.rings.instanceMatrix.needsUpdate = true;
    if (this.rings.instanceColor) this.rings.instanceColor.needsUpdate = true;
    for (const id of this.anim.keys()) if (!seen.has(id)) this.anim.delete(id);
  }

  private updateCorpses(dt: number): void {
    const stay = DATA.game.effects.corpseSeconds;
    for (let i = this.corpses.length - 1; i >= 0; i--) {
      const c = this.corpses[i] as Corpse;
      c.age += dt;
      const fall = Math.min(1, c.age / 0.45);
      const statue = c.group.children[0];
      if (statue) statue.rotation.z = (Math.PI / 2) * (1 - Math.pow(1 - fall, 3)); // topple sideways
      const sink = Math.max(0, c.age - (stay - 1));
      c.group.position.y = -sink * 0.5;
      if (c.age >= stay) {
        this.group.remove(c.group);
        this.corpses.splice(i, 1);
      }
    }
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
      color: '#ffffff',
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const rings = new THREE.InstancedMesh(geometry, material, capacity);
    rings.setColorAt(0, tmpColor.set('#ffffff'));
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
