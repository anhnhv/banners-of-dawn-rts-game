/**
 * Camera input (PLAN §7.11): arrow keys, screen-edge scrolling, middle-drag panning and wheel zoom.
 * Also tracks the pointer position so screens can pick the tile under the cursor.
 */
import type { CameraRig } from '../three/CameraRig';

const EDGE_SCROLL_PX = 6;
const PAN_SPEED = 0.9; // camera distances per second
const ZOOM_SENSITIVITY = 0.0012;

export class CameraController {
  edgeScroll = true;
  /** Pointer position in client pixels, or null when it is outside the window. */
  pointer: { x: number; y: number } | null = null;
  /** True while the pointer is over the 3D canvas (not over the HUD). */
  overCanvas = false;

  private readonly keys = new Set<string>();
  private dragging: { x: number; y: number } | null = null;
  private readonly cleanups: Array<() => void> = [];

  constructor(
    private readonly rig: CameraRig,
    private readonly canvas: HTMLCanvasElement,
  ) {
    this.listen(window, 'keydown', (e) => this.keys.add((e as KeyboardEvent).key));
    this.listen(window, 'keyup', (e) => this.keys.delete((e as KeyboardEvent).key));
    this.listen(window, 'blur', () => this.keys.clear());
    this.listen(window, 'pointermove', (e) => this.onPointerMove(e as PointerEvent));
    this.listen(document, 'pointerleave', () => (this.pointer = null));
    this.listen(window, 'pointerup', () => (this.dragging = null));
    this.listen(canvas, 'pointerover', () => (this.overCanvas = true));
    this.listen(canvas, 'pointerout', () => (this.overCanvas = false));
    this.listen(canvas, 'pointerdown', (e) => {
      const pe = e as PointerEvent;
      if (pe.button === 1) {
        pe.preventDefault();
        this.dragging = { x: pe.clientX, y: pe.clientY };
      }
    });
    this.listen(canvas, 'contextmenu', (e) => e.preventDefault());
    this.listen(
      canvas,
      'wheel',
      (e) => {
        e.preventDefault();
        this.rig.zoom(Math.exp((e as WheelEvent).deltaY * ZOOM_SENSITIVITY));
      },
      { passive: false },
    );
  }

  /** Apply keyboard and edge scrolling; call once per frame. */
  update(dtSeconds: number): void {
    let dx = 0;
    let dy = 0;
    if (this.keys.has('ArrowLeft')) dx -= 1;
    if (this.keys.has('ArrowRight')) dx += 1;
    if (this.keys.has('ArrowUp')) dy += 1;
    if (this.keys.has('ArrowDown')) dy -= 1;
    const p = this.pointer;
    if (this.edgeScroll && p && !this.dragging) {
      if (p.x <= EDGE_SCROLL_PX) dx -= 1;
      if (p.x >= window.innerWidth - EDGE_SCROLL_PX) dx += 1;
      if (p.y <= EDGE_SCROLL_PX) dy += 1;
      if (p.y >= window.innerHeight - EDGE_SCROLL_PX) dy -= 1;
    }
    if (dx !== 0 || dy !== 0) {
      const speed = this.rig.distance * PAN_SPEED * dtSeconds;
      this.rig.pan(dx * speed, dy * speed);
    }
  }

  /** Pointer position in normalized device coordinates of the canvas, or null. */
  pointerNdc(): { x: number; y: number } | null {
    if (!this.pointer) return null;
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((this.pointer.x - rect.left) / rect.width) * 2 - 1,
      y: -(((this.pointer.y - rect.top) / rect.height) * 2 - 1),
    };
  }

  dispose(): void {
    this.cleanups.forEach((fn) => fn());
    this.cleanups.length = 0;
  }

  private onPointerMove(e: PointerEvent): void {
    this.pointer = { x: e.clientX, y: e.clientY };
    if (!this.dragging) return;
    const wpp = this.rig.worldPerPixel(this.canvas.clientHeight || window.innerHeight);
    const pitch = Math.sin(this.rig.pitch);
    this.rig.pan(-(e.clientX - this.dragging.x) * wpp, ((e.clientY - this.dragging.y) * wpp) / pitch);
    this.dragging = { x: e.clientX, y: e.clientY };
  }

  private listen(
    target: EventTarget,
    type: string,
    handler: (e: Event) => void,
    options?: AddEventListenerOptions,
  ): void {
    target.addEventListener(type, handler, options);
    this.cleanups.push(() => target.removeEventListener(type, handler, options));
  }
}
