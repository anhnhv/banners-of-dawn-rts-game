/**
 * M1 map view: renders a decoded map in the voxel style with the RTS camera, highlights the tile
 * under the cursor and keeps the minimap's camera view in sync. Gameplay arrives in M2+.
 */
import type { DecodedMap } from '../../shared';
import { buildMapScene, type MapScene } from '../art/mapScene';
import { MapHud } from '../hud/MapHud';
import { Minimap } from '../hud/Minimap';
import { CameraController } from '../input/CameraController';
import { TileCursor } from '../three/TileCursor';
import { World3D } from '../three/World3D';

export interface MapViewOptions {
  /** Validator warnings to surface in the HUD. */
  warnings?: readonly string[];
}

const CORNERS: Array<[number, number]> = [
  [-1, 1],
  [1, 1],
  [1, -1],
  [-1, -1],
];

export class MapViewScreen {
  private readonly world: World3D;
  private readonly scene: MapScene;
  private readonly camera: CameraController;
  private readonly cursor = new TileCursor();
  private readonly minimap: Minimap;
  private readonly hud: MapHud;
  /** For each tile, the index of the map object covering it, or -1. */
  private readonly objectAt: Int32Array;
  private time = 0;
  private last = 0;
  private fpsFrames = 0;
  private fpsTime = 0;
  private rafId = 0;

  constructor(
    container: HTMLElement,
    private readonly map: DecodedMap,
    options: MapViewOptions = {},
  ) {
    this.world = new World3D(container, { minX: 0, maxX: map.width, minZ: 0, maxZ: map.height });
    this.scene = buildMapScene(map);
    this.world.scene.add(this.scene.group, this.cursor.object);

    // Start looking at the human player's base.
    const home = map.objects.find((o) => o.kind === 'spawn' && o.player === 0);
    const rig = this.world.rig;
    rig.target.set(
      home ? home.x + home.w / 2 : map.width / 2,
      0,
      home ? home.y + home.h / 2 : map.height / 2,
    );
    rig.distance = 26;
    rig.update();

    this.camera = new CameraController(rig, this.world.canvas);
    this.minimap = new Minimap(map, 230, Math.sin(rig.pitch));
    this.minimap.onNavigate = (x, z) => {
      rig.target.set(x, 0, z);
      rig.pan(0, 0); // clamp + update
    };
    this.hud = new MapHud(container, map, this.minimap, options.warnings ?? []);

    this.objectAt = new Int32Array(map.width * map.height).fill(-1);
    map.objects.forEach((o, i) => {
      for (let y = o.y; y < o.y + o.h; y++)
        for (let x = o.x; x < o.x + o.w; x++) this.objectAt[y * map.width + x] = i;
    });
  }

  start(): void {
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    cancelAnimationFrame(this.rafId);
    this.camera.dispose();
  }

  private readonly frame = (now: number): void => {
    const dt = this.last === 0 ? 0 : Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    this.time += dt;

    this.camera.update(dt);
    this.updateHover();
    this.scene.terrain.update(this.time);
    const stats = this.world.render();
    this.minimap.draw(this.cameraFootprint());

    this.fpsFrames++;
    this.fpsTime += dt;
    if (this.fpsTime >= 0.5) {
      this.hud.setPerf(Math.round(this.fpsFrames / this.fpsTime), stats.drawCalls, stats.triangles);
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }
    this.rafId = requestAnimationFrame(this.frame);
  };

  private updateHover(): void {
    const ndc = this.camera.overCanvas ? this.camera.pointerNdc() : null;
    const hit = ndc ? this.world.rig.groundAt(ndc.x, ndc.y) : null;
    if (!hit) {
      this.cursor.set(null);
      this.hud.clearTile();
      return;
    }
    const x = Math.floor(hit.x);
    const y = Math.floor(hit.z);
    const inside = x >= 0 && y >= 0 && x < this.map.width && y < this.map.height;
    const prev = this.cursor.current;
    if (prev && prev.x === x && prev.y === y) return;
    this.cursor.set(inside ? { x, y } : null);
    if (!inside) {
      this.hud.showTile(x, y, null, null);
      return;
    }
    const i = y * this.map.width + x;
    const objectIndex = this.objectAt[i] ?? -1;
    this.hud.showTile(
      x,
      y,
      this.map.terrain[i] ?? null,
      objectIndex >= 0 ? (this.map.objects[objectIndex] ?? null) : null,
    );
  }

  /** The ground area visible on screen, as 4 grid points (for the minimap). */
  private cameraFootprint(): Array<{ x: number; z: number }> | null {
    const out: Array<{ x: number; z: number }> = [];
    for (const [nx, ny] of CORNERS) {
      const hit = this.world.rig.groundAt(nx, ny);
      if (!hit) return null;
      out.push({ x: hit.x, z: hit.z });
    }
    return out;
  }
}
