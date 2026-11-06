/**
 * Interactive minimap (PLAN §7.10): terrain, resources and bases drawn as a diamond that matches the
 * camera, the camera's view as a trapezoid, and click/drag to move the camera.
 */
import type { DecodedMap, TerrainType } from '../../shared';
import { hex, resolveColor } from '../art/palette';
import {
  gridToMinimap,
  makeMinimapProjection,
  minimapToGrid,
  minimapTransform,
  type MinimapProjection,
} from './minimapMath';

const TERRAIN_COLOR: Record<TerrainType, string> = {
  grass: 'grass',
  dirt: 'dirt',
  sand: 'sand',
  shallow: 'shallow',
  water: 'water',
  rock: 'stone-dark',
};

export class Minimap {
  readonly element: HTMLCanvasElement;
  readonly projection: MinimapProjection;
  /** Called with a grid position when the player clicks or drags on the minimap. */
  onNavigate: ((x: number, z: number) => void) | null = null;

  private readonly ctx: CanvasRenderingContext2D;
  private readonly base: HTMLCanvasElement;
  private readonly dpr: number;

  constructor(
    private readonly map: DecodedMap,
    widthPx: number,
    flatten: number,
  ) {
    this.projection = makeMinimapProjection(map.width, map.height, widthPx, flatten);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.element = document.createElement('canvas');
    this.element.className = 'minimap-canvas';
    this.element.width = Math.round(this.projection.width * this.dpr);
    this.element.height = Math.round(this.projection.height * this.dpr);
    this.element.style.width = `${this.projection.width}px`;
    this.element.style.height = `${this.projection.height}px`;
    const ctx = this.element.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available.');
    this.ctx = ctx;
    this.base = this.paintBase();
    this.bindInput();
  }

  /** Redraw with the camera's ground footprint (4 grid points), if known. */
  draw(cameraQuad: Array<{ x: number; z: number }> | null): void {
    const { ctx, projection: p, dpr } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.element.width, this.element.height);
    const [a, b, c, d, e, f] = minimapTransform(p);
    ctx.setTransform(a * dpr, b * dpr, c * dpr, d * dpr, e * dpr, f * dpr);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.base, 0, 0);

    if (cameraQuad && cameraQuad.length === 4) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.beginPath();
      cameraQuad.forEach((pt, i) => {
        const { u, v } = gridToMinimap(p, pt.x, pt.z);
        if (i === 0) ctx.moveTo(u, v);
        else ctx.lineTo(u, v);
      });
      ctx.closePath();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }
  }

  private paintBase(): HTMLCanvasElement {
    const { map } = this;
    const canvas = document.createElement('canvas');
    canvas.width = map.width;
    canvas.height = map.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available.');
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        ctx.fillStyle = hex(TERRAIN_COLOR[map.terrain[y * map.width + x] ?? 'grass']);
        ctx.fillRect(x, y, 1, 1);
      }
    }
    for (const o of map.objects) {
      if (o.kind === 'tree' || o.kind === 'pine') ctx.fillStyle = hex('leaf-dark');
      else if (o.kind === 'gold_mine') ctx.fillStyle = hex('gold');
      else if (o.kind === 'berry_bush') ctx.fillStyle = hex('berry');
      else if (o.kind === 'stone') ctx.fillStyle = hex('stone');
      else ctx.fillStyle = resolveColor('team', o.player === 1 ? 'red' : 'blue');
      ctx.fillRect(o.x, o.y, o.w, o.h);
    }
    return canvas;
  }

  private bindInput(): void {
    let dragging = false;
    const navigate = (e: PointerEvent): void => {
      const rect = this.element.getBoundingClientRect();
      const g = minimapToGrid(this.projection, e.clientX - rect.left, e.clientY - rect.top);
      const x = Math.min(this.map.width, Math.max(0, g.x));
      const z = Math.min(this.map.height, Math.max(0, g.z));
      this.onNavigate?.(x, z);
    };
    this.element.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      dragging = true;
      this.element.setPointerCapture(e.pointerId);
      navigate(e);
    });
    this.element.addEventListener('pointermove', (e) => {
      if (dragging) navigate(e);
    });
    this.element.addEventListener('pointerup', (e) => {
      dragging = false;
      this.element.releasePointerCapture(e.pointerId);
    });
    this.element.addEventListener('contextmenu', (e) => e.preventDefault());
  }
}
