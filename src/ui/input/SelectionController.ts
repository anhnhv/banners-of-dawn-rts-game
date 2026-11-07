/**
 * Selection and orders (PLAN §7.11):
 *  left click        select the unit under the cursor (shift: add/remove); otherwise a building
 *                    or a resource
 *  left drag         box select own units (shift: add)
 *  double click      select all own units of that type on screen
 *  right click       with own units: on a resource/building → interact (the engine decides from the
 *                    unit config: gather, drop off, …); on the ground → move (shift: queue)
 *                    with an own building selected → set its rally point
 *  Ctrl/Alt + 1..9   assign control group; 1..9 select it; press twice to center the camera on it
 *  Esc               cancel placement / targeting / the build menu, then clear the selection
 * While placing a building (build menu): left click places it (shift: place more), right click
 * cancels.
 * Command hotkeys (from the config `actions`) are handled by the HUD through `onKey`.
 */
import * as THREE from 'three';
import type { Command, EntityId, PlayerId } from '../../shared';
import type { UnitScreenState } from '../render/UnitRenderer';
import type { CameraRig } from '../three/CameraRig';
import { pickAt, sameTypeOnScreen, unitsInRect, type ScreenUnit } from './picking';

const DRAG_THRESHOLD_PX = 5;
const DOUBLE_TAP_MS = 350;

export interface SelectionOptions {
  container: HTMLElement;
  canvas: HTMLCanvasElement;
  rig: CameraRig;
  player: PlayerId;
  units: () => readonly UnitScreenState[];
  /** Building or resource under the cursor (client px), if any. */
  pickOther: (clientX: number, clientY: number) => EntityId | null;
  /** True if `id` is an own building that has a setRally action. */
  canRally: (id: EntityId) => boolean;
  /** True if `id` is a resource node. */
  isResource: (id: EntityId) => boolean;
  onCommand: (cmd: Command) => void;
  onMoveMarker: (x: number, z: number, color?: string) => void;
  onChange: () => void;
  /** Gets every key first; return true to consume it (command hotkeys). */
  onKey: (e: KeyboardEvent) => boolean;
  /** Building placement mode (see PlacementController). */
  placement: { readonly active: boolean; place(shift: boolean): void; cancel(): void };
  /** Esc after placement and targeting: return true if it closed something (e.g. the build menu). */
  onEscape: () => boolean;
}

export class SelectionController {
  readonly selected = new Set<EntityId>();
  private readonly groups = new Map<number, EntityId[]>();
  private readonly box: HTMLDivElement;
  private dragStart: { x: number; y: number; shift: boolean } | null = null;
  private dragging = false;
  private lastGroupTap = { group: -1, time: 0 };
  /** Waiting for a click to place this building's rally point. */
  private rallyFor: EntityId | null = null;
  private readonly cleanups: Array<() => void> = [];
  private readonly v = new THREE.Vector3();

  constructor(private readonly o: SelectionOptions) {
    this.box = document.createElement('div');
    this.box.className = 'select-box';
    o.container.append(this.box);

    this.listen(o.canvas, 'pointerdown', (e) => this.onPointerDown(e as PointerEvent));
    this.listen(window, 'pointermove', (e) => this.onPointerMove(e as PointerEvent));
    this.listen(window, 'pointerup', (e) => this.onPointerUp(e as PointerEvent));
    this.listen(o.canvas, 'dblclick', (e) => this.onDoubleClick(e as MouseEvent));
    this.listen(window, 'keydown', (e) => this.onKey(e as KeyboardEvent));
  }

  /** Start "click to set the rally point" mode for a building. */
  beginRally(building: EntityId): void {
    this.rallyFor = building;
    this.o.canvas.classList.add('targeting');
  }

  /** Replace the selection (e.g. idle worker button). */
  select(ids: EntityId[]): void {
    this.selected.clear();
    ids.forEach((id) => this.selected.add(id));
    this.o.onChange();
  }

  /** Drop ids that no longer exist (call once per frame with every live entity id). */
  prune(alive: (id: EntityId) => boolean): void {
    let changed = false;
    for (const id of this.selected) {
      if (!alive(id)) {
        this.selected.delete(id);
        changed = true;
      }
    }
    if (changed) this.o.onChange();
  }

  centerOn(x: number, z: number): void {
    this.o.rig.target.set(x, 0, z);
    this.o.rig.pan(0, 0);
  }

  dispose(): void {
    this.cleanups.forEach((fn) => fn());
    this.box.remove();
  }

  // ---- input -------------------------------------------------------------------------------------

  private onPointerDown(e: PointerEvent): void {
    if (this.o.placement.active) {
      if (e.button === 0) this.o.placement.place(e.shiftKey);
      else if (e.button === 2) this.o.placement.cancel();
      return;
    }
    if (e.button === 0) {
      if (this.rallyFor !== null) {
        this.placeRally(this.rallyFor, e.clientX, e.clientY);
        this.endRally();
        return;
      }
      this.dragStart = { x: e.clientX, y: e.clientY, shift: e.shiftKey };
      this.dragging = false;
    } else if (e.button === 2) {
      if (this.rallyFor !== null) {
        this.endRally();
        return;
      }
      this.rightClick(e.clientX, e.clientY, e.shiftKey);
    }
  }

  private onPointerMove(e: PointerEvent): void {
    const s = this.dragStart;
    if (!s) return;
    if (!this.dragging && Math.hypot(e.clientX - s.x, e.clientY - s.y) > DRAG_THRESHOLD_PX)
      this.dragging = true;
    if (this.dragging) {
      Object.assign(this.box.style, {
        display: 'block',
        left: `${Math.min(s.x, e.clientX)}px`,
        top: `${Math.min(s.y, e.clientY)}px`,
        width: `${Math.abs(e.clientX - s.x)}px`,
        height: `${Math.abs(e.clientY - s.y)}px`,
      });
    }
  }

  private onPointerUp(e: PointerEvent): void {
    const s = this.dragStart;
    if (!s || e.button !== 0) return;
    this.dragStart = null;
    this.box.style.display = 'none';
    const units = this.screenUnits();
    const rect = this.o.canvas.getBoundingClientRect();
    if (this.dragging) {
      this.dragging = false;
      const ids = unitsInRect(
        units,
        s.x - rect.left,
        s.y - rect.top,
        e.clientX - rect.left,
        e.clientY - rect.top,
        this.o.player,
      );
      if (!s.shift) this.selected.clear();
      ids.forEach((id) => this.selected.add(id));
    } else {
      const hit = pickAt(units, e.clientX - rect.left, e.clientY - rect.top, this.o.player);
      if (s.shift && hit && hit.owner === this.o.player) {
        if (this.selected.has(hit.id)) this.selected.delete(hit.id);
        else this.selected.add(hit.id);
      } else {
        this.selected.clear();
        const id = hit?.id ?? this.o.pickOther(e.clientX, e.clientY);
        if (id !== null) this.selected.add(id);
      }
    }
    this.o.onChange();
  }

  private onDoubleClick(e: MouseEvent): void {
    const units = this.screenUnits();
    const rect = this.o.canvas.getBoundingClientRect();
    const hit = pickAt(units, e.clientX - rect.left, e.clientY - rect.top, this.o.player);
    if (!hit || hit.owner !== this.o.player) return;
    this.select(sameTypeOnScreen(units, hit.type, this.o.player, rect.width, rect.height));
  }

  private onKey(e: KeyboardEvent): void {
    if (e.repeat) return;
    if (e.code === 'Escape') {
      if (this.o.placement.active) this.o.placement.cancel();
      else if (this.rallyFor !== null) this.endRally();
      else if (!this.o.onEscape()) this.select([]);
      return;
    }
    if (this.o.onKey(e)) {
      e.preventDefault();
      return;
    }
    const digit = /^Digit([1-9])$/.exec(e.code);
    if (!digit) return;
    const group = Number(digit[1]);
    if (e.ctrlKey || e.altKey) {
      e.preventDefault();
      this.groups.set(group, [...this.selected]);
      return;
    }
    const alive = new Set(this.o.units().map((u) => u.id));
    const ids = (this.groups.get(group) ?? []).filter((id) => alive.has(id));
    if (ids.length === 0) return;
    const now = performance.now();
    const doubleTap = this.lastGroupTap.group === group && now - this.lastGroupTap.time < DOUBLE_TAP_MS;
    this.lastGroupTap = { group, time: now };
    this.select(ids);
    if (doubleTap) {
      const sel = this.o.units().filter((u) => this.selected.has(u.id));
      if (sel.length > 0) {
        this.centerOn(
          sel.reduce((s, u) => s + u.x, 0) / sel.length,
          sel.reduce((s, u) => s + u.z, 0) / sel.length,
        );
      }
    }
  }

  // ---- orders ------------------------------------------------------------------------------------

  private rightClick(clientX: number, clientY: number, queue: boolean): void {
    const ground = this.groundAt(clientX, clientY);
    const units = this.ownSelection();
    if (units.length > 0) {
      const target = this.o.pickOther(clientX, clientY);
      if (target !== null) {
        this.o.onCommand({ type: 'interact', units, target, queue });
        if (ground) this.o.onMoveMarker(ground.x, ground.z, '#ffd75a');
      } else if (ground) {
        this.o.onCommand({ type: 'move', units, to: { x: ground.x, y: ground.z }, queue });
        this.o.onMoveMarker(ground.x, ground.z);
      }
      return;
    }
    const building = [...this.selected].find((id) => this.o.canRally(id));
    if (building !== undefined) this.placeRally(building, clientX, clientY);
  }

  private placeRally(building: EntityId, clientX: number, clientY: number): void {
    const ground = this.groundAt(clientX, clientY);
    if (!ground) return;
    const other = this.o.pickOther(clientX, clientY);
    const target = other !== null && this.o.isResource(other) ? other : undefined;
    this.o.onCommand({
      type: 'setRally',
      building,
      to: { x: ground.x, y: ground.z },
      ...(target !== undefined ? { target } : {}),
    });
    this.o.onMoveMarker(ground.x, ground.z, '#7dff6a');
  }

  private endRally(): void {
    this.rallyFor = null;
    this.o.canvas.classList.remove('targeting');
  }

  private groundAt(clientX: number, clientY: number): THREE.Vector3 | null {
    const rect = this.o.canvas.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -(((clientY - rect.top) / rect.height) * 2 - 1);
    return this.o.rig.groundAt(ndcX, ndcY);
  }

  private ownSelection(): EntityId[] {
    const own = new Set(
      this.o
        .units()
        .filter((u) => u.owner === this.o.player)
        .map((u) => u.id),
    );
    return [...this.selected].filter((id) => own.has(id));
  }

  /** Project every unit to canvas pixels. */
  private screenUnits(): ScreenUnit[] {
    const rect = this.o.canvas.getBoundingClientRect();
    const cam = this.o.rig.camera;
    const toScreen = (x: number, y: number, z: number): [number, number] => {
      this.v.set(x, y, z).project(cam);
      return [((this.v.x + 1) / 2) * rect.width, ((1 - this.v.y) / 2) * rect.height];
    };
    return this.o.units().map((u) => {
      const [fx, fy] = toScreen(u.x, 0, u.z);
      const [sx, sy] = toScreen(u.x, 0.28 + u.radius * 0.4, u.z);
      const [ex] = toScreen(u.x + 1, 0, u.z);
      const pxPerTile = Math.max(1, Math.abs(ex - fx) * Math.SQRT2);
      return {
        id: u.id,
        owner: u.owner,
        type: u.type,
        sx,
        sy,
        fx,
        fy,
        pickRadius: Math.max(12, pxPerTile * (u.radius + 0.18)),
      };
    });
  }

  private listen(target: EventTarget, type: string, handler: (e: Event) => void): void {
    target.addEventListener(type, handler);
    this.cleanups.push(() => target.removeEventListener(type, handler));
  }
}
