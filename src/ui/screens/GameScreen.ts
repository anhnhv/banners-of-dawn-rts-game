/**
 * The in-game screen (M2): map + units in 3D, selection and orders, minimap, HUD.
 * It is passive: the host calls frame() every animation frame with the latest PlayerView and the
 * interpolation alpha; player input leaves this screen only as Commands (onCommand).
 */
import type { Command, DecodedMap, PlayerId, PlayerView } from '../../shared';
import { buildMapScene, type MapScene } from '../art/mapScene';
import { MapHud } from '../hud/MapHud';
import { Minimap } from '../hud/Minimap';
import { CameraController } from '../input/CameraController';
import { SelectionController } from '../input/SelectionController';
import { MoveMarkers } from '../render/MoveMarkers';
import { UnitRenderer } from '../render/UnitRenderer';
import { TileCursor } from '../three/TileCursor';
import { World3D } from '../three/World3D';

export interface GameScreenOptions {
  player: PlayerId;
  onCommand: (cmd: Command) => void;
  /** Validator warnings to surface in the HUD. */
  warnings?: readonly string[];
}

const CORNERS: Array<[number, number]> = [
  [-1, 1],
  [1, 1],
  [1, -1],
  [-1, -1],
];

export class GameScreen {
  private readonly world: World3D;
  private readonly scene: MapScene;
  private readonly camera: CameraController;
  private readonly cursor = new TileCursor();
  private readonly minimap: Minimap;
  private readonly hud: MapHud;
  private readonly units = new UnitRenderer();
  private readonly markers = new MoveMarkers();
  private readonly selection: SelectionController;
  private readonly objectAt: Int32Array;
  private lastView: PlayerView | null = null;
  private selectionDirty = true;
  private time = 0;
  private fpsFrames = 0;
  private fpsTime = 0;

  constructor(
    container: HTMLElement,
    private readonly map: DecodedMap,
    private readonly options: GameScreenOptions,
  ) {
    this.world = new World3D(container, { minX: 0, maxX: map.width, minZ: 0, maxZ: map.height });
    this.scene = buildMapScene(map);
    this.world.scene.add(this.scene.group, this.cursor.object, this.units.group, this.markers.group);

    const home = map.objects.find((o) => o.kind === 'spawn' && o.player === options.player);
    const rig = this.world.rig;
    rig.target.set(
      home ? home.x + home.w / 2 : map.width / 2,
      0,
      home ? home.y + home.h / 2 : map.height / 2,
    );
    rig.distance = 24;
    rig.update();

    this.camera = new CameraController(rig, this.world.canvas);
    this.minimap = new Minimap(map, 230, Math.sin(rig.pitch));
    this.minimap.onNavigate = (x, z) => {
      rig.target.set(x, 0, z);
      rig.pan(0, 0);
    };
    this.hud = new MapHud(container, map, this.minimap, options.warnings ?? []);
    this.selection = new SelectionController({
      container,
      canvas: this.world.canvas,
      rig,
      player: options.player,
      units: () => this.units.states,
      onCommand: options.onCommand,
      onMoveMarker: (x, z) => this.markers.spawn(x, z),
      onChange: () => (this.selectionDirty = true),
    });

    this.objectAt = new Int32Array(map.width * map.height).fill(-1);
    map.objects.forEach((o, i) => {
      for (let y = o.y; y < o.y + o.h; y++)
        for (let x = o.x; x < o.x + o.w; x++) this.objectAt[y * map.width + x] = i;
    });
  }

  /** Called by the host every animation frame. */
  frame(dtSeconds: number, view: PlayerView, alpha: number): void {
    this.time += dtSeconds;
    this.lastView = view;
    this.camera.update(dtSeconds);
    this.units.update(view, alpha, dtSeconds, this.selection.selected);
    this.selection.prune();
    this.markers.update(dtSeconds);
    this.updateHover();
    this.scene.terrain.update(this.time);
    const stats = this.world.render();
    this.minimap.draw(this.cameraFootprint(), this.units.states);
    if (this.selectionDirty) this.updateSelectionHud();

    this.fpsFrames++;
    this.fpsTime += dtSeconds;
    if (this.fpsTime >= 0.5) {
      this.hud.setPerf(Math.round(this.fpsFrames / this.fpsTime), stats.drawCalls, stats.triangles);
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }
  }

  dispose(): void {
    this.camera.dispose();
    this.selection.dispose();
    this.world.destroy();
  }

  private updateSelectionHud(): void {
    this.selectionDirty = false;
    const view = this.lastView;
    if (!view || this.selection.selected.size === 0) {
      this.hud.setSelection(null);
      return;
    }
    const counts = new Map<string, number>();
    let enemy = false;
    for (const u of view.units) {
      if (!this.selection.selected.has(u.id)) continue;
      if (u.owner !== this.options.player) enemy = true;
      counts.set(u.type, (counts.get(u.type) ?? 0) + 1);
    }
    const parts = [...counts].map(([type, n]) => `${UNIT_NAMES[type] ?? type} ×${n}`);
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    this.hud.setSelection(enemy ? `Enemy: ${parts.join(', ')}` : `Selected ${total}: ${parts.join(', ')}`);
  }

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

const UNIT_NAMES: Record<string, string> = {
  worker: 'Worker',
  militia: 'Militia',
  archer: 'Archer',
  scout_rider: 'Scout Rider',
  knight: 'Knight',
  catapult: 'Catapult',
};
