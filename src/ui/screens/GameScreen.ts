/**
 * The in-game screen: map, units and buildings in 3D, selection and orders, minimap, HUD.
 * It is passive: the host calls frame() every animation frame with the latest PlayerView, the
 * interpolation alpha and the engine events; player input leaves this screen only as Commands.
 */
import * as THREE from 'three';
import type { Command, DecodedMap, EntityId, GameEvent, PlayerId, PlayerView } from '../../shared';
import { buildMapScene, tileKey, type MapScene } from '../art/mapScene';
import { DATA, displayName } from '../data';
import { GameHud } from '../hud/GameHud';
import { Minimap } from '../hud/Minimap';
import { CameraController } from '../input/CameraController';
import { SelectionController } from '../input/SelectionController';
import { BuildingRenderer } from '../render/BuildingRenderer';
import { MoveMarkers } from '../render/MoveMarkers';
import { UnitRenderer } from '../render/UnitRenderer';
import { TileCursor } from '../three/TileCursor';
import { World3D } from '../three/World3D';

export interface GameScreenOptions {
  player: PlayerId;
  onCommand: (cmd: Command) => void;
  /** Validator warnings to surface in the console. */
  warnings?: readonly string[];
}

const CORNERS: Array<[number, number]> = [
  [-1, 1],
  [1, 1],
  [1, -1],
  [-1, -1],
];

const REJECT_TEXT: Record<string, string> = {
  NOT_ENOUGH_FOOD: 'Not enough food',
  NOT_ENOUGH_WOOD: 'Not enough wood',
  NOT_ENOUGH_GOLD: 'Not enough gold',
  QUEUE_FULL: 'The queue is full',
  NOT_AVAILABLE: 'Not available here',
};

export class GameScreen {
  private readonly world: World3D;
  private readonly scene: MapScene;
  private readonly camera: CameraController;
  private readonly cursor = new TileCursor();
  private readonly minimap: Minimap;
  private readonly hud: GameHud;
  private readonly units = new UnitRenderer();
  private readonly buildings = new BuildingRenderer();
  private readonly markers = new MoveMarkers();
  private readonly selection: SelectionController;
  private readonly objectAt: Int32Array;
  private readonly raycaster = new THREE.Raycaster();
  /** Tile → resource node id, rebuilt when nodes disappear. */
  private nodeAtTile = new Map<string, EntityId>();
  private seenResourcesVersion = -1;
  private lastView: PlayerView | null = null;
  private idleCursor = 0;
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
    this.world.scene.add(
      this.scene.group,
      this.buildings.group,
      this.cursor.object,
      this.units.group,
      this.markers.group,
    );

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
    this.hud = new GameHud(container, map, this.minimap, options.warnings ?? [], {
      onCommand: options.onCommand,
      onSelectIdleWorker: () => this.selectIdleWorker(),
      onBeginRally: (id) => this.selection.beginRally(id),
    });
    this.selection = new SelectionController({
      container,
      canvas: this.world.canvas,
      rig,
      player: options.player,
      units: () => this.units.states,
      pickOther: (x, y) => this.pickOther(x, y),
      canRally: (id) => {
        const b = this.lastView?.buildings.find((x) => x.id === id);
        return (
          !!b &&
          b.owner === options.player &&
          !!DATA.buildings[b.type]?.actions.some((a) => a.type === 'setRally')
        );
      },
      isResource: (id) => !!this.lastView?.resources.has(id),
      onCommand: options.onCommand,
      onMoveMarker: (x, z, color) => this.markers.spawn(x, z, color),
      onChange: () => {},
      onKey: (e) => {
        if (e.code === 'Period') {
          this.selectIdleWorker();
          return true;
        }
        return this.hud.handleKey(e);
      },
    });

    this.objectAt = new Int32Array(map.width * map.height).fill(-1);
    map.objects.forEach((o, i) => {
      for (let y = o.y; y < o.y + o.h; y++)
        for (let x = o.x; x < o.x + o.w; x++) this.objectAt[y * map.width + x] = i;
    });
  }

  /** Called by the host every animation frame. */
  frame(dtSeconds: number, view: PlayerView, alpha: number, events: readonly GameEvent[] = []): void {
    this.time += dtSeconds;
    this.lastView = view;
    this.syncResources(view);
    this.showEvents(events);
    this.camera.update(dtSeconds);
    this.units.update(view, alpha, dtSeconds, this.selection.selected);
    this.buildings.update(view, this.selection.selected);
    this.selection.prune(
      (id) =>
        view.units.some((u) => u.id === id) ||
        view.buildings.some((b) => b.id === id) ||
        view.resources.has(id),
    );
    this.markers.update(dtSeconds);
    this.updateHover();
    this.scene.terrain.update(this.time);
    const stats = this.world.render();
    this.minimap.draw(this.cameraFootprint(), this.units.states);
    this.hud.update(view, this.selection.selected);

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

  /** Hide used-up resources and refresh the tile → node lookup (only when nodes disappeared). */
  private syncResources(view: PlayerView): void {
    if (view.resourcesVersion === this.seenResourcesVersion) return;
    this.seenResourcesVersion = view.resourcesVersion;
    const alive = new Set<string>();
    const lookup = new Map<string, EntityId>();
    for (const r of view.resources.values()) {
      alive.add(tileKey(r.x, r.y));
      for (let y = r.y; y < r.y + r.h; y++)
        for (let x = r.x; x < r.x + r.w; x++) lookup.set(tileKey(x, y), r.id);
    }
    for (const key of [...this.scene.objectTiles()]) {
      if (alive.has(key)) continue;
      const [x, y] = key.split(',').map(Number);
      this.scene.hideObjectAt(x ?? 0, y ?? 0);
    }
    this.nodeAtTile = lookup;
  }

  private showEvents(events: readonly GameEvent[]): void {
    const me = this.options.player;
    for (const e of events) {
      if (e.type === 'commandRejected' && e.player === me)
        this.hud.message(REJECT_TEXT[e.reason] ?? e.reason, 'warn');
      else if (e.type === 'popCapped' && e.player === me) this.hud.message('Need more houses', 'warn');
      else if (e.type === 'unitTrained' && e.player === me)
        this.hud.message(`${displayName(e.unitType)} ready`);
    }
  }

  /** Building or resource under the cursor: by ray against the models, then by ground tile. */
  private pickOther(clientX: number, clientY: number): EntityId | null {
    const rect = this.world.canvas.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -(((clientY - rect.top) / rect.height) * 2 - 1);
    const building = this.buildings.pick(ndcX, ndcY, this.world.rig.camera);
    if (building !== null) return building;
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.world.rig.camera);
    const key = this.scene.pickObject(this.raycaster);
    if (key) return this.nodeAtTile.get(key) ?? null;
    const hit = this.world.rig.groundAt(ndcX, ndcY);
    if (!hit) return null;
    return this.nodeAtTile.get(tileKey(Math.floor(hit.x), Math.floor(hit.z))) ?? null;
  }

  private selectIdleWorker(): void {
    const view = this.lastView;
    if (!view) return;
    const idle = view.units.filter(
      (u) => u.owner === this.options.player && !u.hasOrders && !!DATA.units[u.type]?.interactions.gather,
    );
    if (idle.length === 0) return;
    const u = idle[this.idleCursor++ % idle.length];
    if (!u) return;
    this.selection.select([u.id]);
    this.selection.centerOn(u.x, u.y);
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
    const object = objectIndex >= 0 ? (this.map.objects[objectIndex] ?? null) : null;
    const stillThere =
      object && object.kind !== 'stone' ? this.nodeAtTile.has(tileKey(object.x, object.y)) : true;
    this.hud.showTile(x, y, this.map.terrain[i] ?? null, stillThere ? object : null);
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
