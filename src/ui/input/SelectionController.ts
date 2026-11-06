/**
 * Selection and orders (PLAN §7.11):
 *  left click        select the unit under the cursor (shift: add/remove)
 *  left drag         box select own units (shift: add)
 *  double click      select all own units of that type on screen
 *  right click       move the selection there (shift: queue the move)
 *  W                 stop
 *  Ctrl/Alt + 1..9   assign control group; 1..9 select it; press twice to center the camera on it
 *  Esc               clear the selection
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
  onCommand: (cmd: Command) => void;
  onMoveMarker: (x: number, z: number) => void;
  onChange: () => void;
}

export class SelectionController {
  readonly selected = new Set<EntityId>();
  private readonly groups = new Map<number, EntityId[]>();
  private readonly box: HTMLDivElement;
  private dragStart: { x: number; y: number; shift: boolean } | null = null;
  private dragging = false;
  private lastGroupTap = { group: -1, time: 0 };
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

  /** Drop ids that no longer exist (call once per frame). */
  prune(): void {
    if (this.selected.size === 0) return;
    const alive = new Set(this.o.units().map((u) => u.id));
    let changed = false;
    for (const id of this.selected) {
      if (!alive.has(id)) {
        this.selected.delete(id);
        changed = true;
      }
    }
    if (changed) this.o.onChange();
  }

  dispose(): void {
    this.cleanups.forEach((fn) => fn());
    this.box.remove();
  }

  // ---- input -------------------------------------------------------------------------------------

  private onPointerDown(e: PointerEvent): void {
    if (e.button === 0) {
      this.dragStart = { x: e.clientX, y: e.clientY, shift: e.shiftKey };
      this.dragging = false;
    } else if (e.button === 2) {
      this.orderMove(e.clientX, e.clientY, e.shiftKey);
    }
  }

  private onPointerMove(e: PointerEvent): void {
    const s = this.dragStart;
    if (!s) return;
    if (!this.dragging && Math.hypot(e.clientX - s.x, e.clientY - s.y) > DRAG_THRESHOLD_PX)
      this.dragging = true;
    if (this.dragging) {
      const left = Math.min(s.x, e.clientX);
      const top = Math.min(s.y, e.clientY);
      Object.assign(this.box.style, {
        display: 'block',
        left: `${left}px`,
        top: `${top}px`,
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
        if (hit) this.selected.add(hit.id);
      }
    }
    this.o.onChange();
  }

  private onDoubleClick(e: MouseEvent): void {
    const units = this.screenUnits();
    const rect = this.o.canvas.getBoundingClientRect();
    const hit = pickAt(units, e.clientX - rect.left, e.clientY - rect.top, this.o.player);
    if (!hit || hit.owner !== this.o.player) return;
    this.selected.clear();
    sameTypeOnScreen(units, hit.type, this.o.player, rect.width, rect.height).forEach((id) =>
      this.selected.add(id),
    );
    this.o.onChange();
  }

  private onKey(e: KeyboardEvent): void {
    if (e.repeat) return;
    const digit = /^Digit([1-9])$/.exec(e.code);
    if (digit) {
      const group = Number(digit[1]);
      if (e.ctrlKey || e.altKey) {
        e.preventDefault();
        this.groups.set(group, [...this.selected]);
        return;
      }
      const ids = (this.groups.get(group) ?? []).filter((id) => this.o.units().some((u) => u.id === id));
      if (ids.length === 0) return;
      const now = performance.now();
      const doubleTap = this.lastGroupTap.group === group && now - this.lastGroupTap.time < DOUBLE_TAP_MS;
      this.lastGroupTap = { group, time: now };
      this.selected.clear();
      ids.forEach((id) => this.selected.add(id));
      this.o.onChange();
      if (doubleTap) this.centerOnSelection();
      return;
    }
    if (e.code === 'KeyW' && this.ownSelection().length > 0) {
      this.o.onCommand({ type: 'stop', units: this.ownSelection() });
    } else if (e.code === 'Escape') {
      this.selected.clear();
      this.o.onChange();
    }
  }

  // ---- helpers -----------------------------------------------------------------------------------

  private orderMove(clientX: number, clientY: number, queue: boolean): void {
    const units = this.ownSelection();
    if (units.length === 0) return;
    const rect = this.o.canvas.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -(((clientY - rect.top) / rect.height) * 2 - 1);
    const hit = this.o.rig.groundAt(ndcX, ndcY);
    if (!hit) return;
    this.o.onCommand({ type: 'move', units, to: { x: hit.x, y: hit.z }, queue });
    this.o.onMoveMarker(hit.x, hit.z);
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

  private centerOnSelection(): void {
    const sel = this.o.units().filter((u) => this.selected.has(u.id));
    if (sel.length === 0) return;
    const x = sel.reduce((s, u) => s + u.x, 0) / sel.length;
    const z = sel.reduce((s, u) => s + u.z, 0) / sel.length;
    this.o.rig.target.set(x, 0, z);
    this.o.rig.pan(0, 0);
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
