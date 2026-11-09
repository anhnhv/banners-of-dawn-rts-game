/**
 * The in-game screen: map, units and buildings in 3D, selection and orders, minimap, HUD.
 * It is passive: the host calls frame() every animation frame with the latest PlayerView, the
 * interpolation alpha and the engine events; player input leaves this screen only as Commands.
 */
import * as THREE from 'three';
import {
  TICK_RATE,
  costEntries,
  type Command,
  type DecodedMap,
  type EntityId,
  type GameEvent,
  type MatchRules,
  type PlayerId,
  type PlayerView,
  type TerrainType,
} from '../../shared';
import terrainData from '../../data/terrain.json';
import { buildMapScene, tileKey, type MapScene } from '../art/mapScene';
import { DATA, displayName } from '../data';
import { GameHud } from '../hud/GameHud';
import { Minimap } from '../hud/Minimap';
import { CameraController, WHEEL_STEP } from '../input/CameraController';
import { PlacementController } from '../input/PlacementController';
import { SelectionController } from '../input/SelectionController';
import { BuildingRenderer } from '../render/BuildingRenderer';
import { Effects } from '../render/Effects';
import { HealthBars } from '../render/HealthBars';
import { ProjectileRenderer } from '../render/ProjectileRenderer';
import { MoveMarkers } from '../render/MoveMarkers';
import { UnitRenderer } from '../render/UnitRenderer';
import { SCROLL_FACTOR, type Settings } from '../settings';
import { TileCursor } from '../three/TileCursor';
import { World3D } from '../three/World3D';
import { PauseMenu } from './PauseMenu';

/** What the screen may ask of the host: time control and leaving the match. */
export interface MatchControls {
  setPaused(paused: boolean): void;
  setSpeed(speed: number): void;
  /** Restart / Play again: a new match with the same setup. */
  restart(): void;
  /** Quit / Main menu. */
  quit(): void;
}

export interface GameScreenOptions {
  player: PlayerId;
  onCommand: (cmd: Command) => void;
  /** Validator warnings to surface in the console. */
  warnings?: readonly string[];
  /** The match's pace (tooltips and timers show the real times). */
  rules: MatchRules;
  controls: MatchControls;
  /** Game speeds offered by + / - and the pause menu, and the one to start with. */
  speeds: readonly number[];
  speed: number;
  settings: Settings;
  /** A setting was changed in the pause menu (the host saves it). */
  onSettings(settings: Settings): void;
}

/**
 * Camera distance at the start of a match: 24 plus four mouse-wheel notches out (≈ 38.8).
 * The user found 24 too close (2026-11-09: two notches out, then two more).
 */
const DEFAULT_ZOOM = 24 * WHEEL_STEP ** 4;

const CORNERS: Array<[number, number]> = [
  [-1, 1],
  [1, 1],
  [1, -1],
  [-1, -1],
];

const BUILDABLE: Record<TerrainType, boolean> = Object.fromEntries(
  Object.entries(terrainData.types).map(([k, t]) => [k, t.buildable]),
) as Record<TerrainType, boolean>;

const REJECT_TEXT: Record<string, string> = {
  BAD_PLACEMENT: "Can't build there",
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
  private readonly effects = new Effects();
  private readonly bars = new HealthBars();
  private readonly units = new UnitRenderer(this.effects, this.bars);
  private readonly buildings = new BuildingRenderer(this.effects, this.bars);
  private readonly projectiles = new ProjectileRenderer();
  private readonly markers = new MoveMarkers();
  private readonly selection: SelectionController;
  private readonly placement: PlacementController;
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
  private readonly pauseMenu: PauseMenu;
  private speed: number;
  private paused = false;
  private settings: Settings;

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
      this.projectiles.group,
      this.effects.group,
      this.bars.group,
    );
    this.placement = new PlacementController({
      player: options.player,
      tileFree: (x, y) => this.tileFree(x, y),
      canAfford: (type) => {
        const res = this.lastView?.self.resources;
        return !!res && costEntries(DATA.buildings[type]?.cost ?? {}).every(([r, n]) => res[r] >= n);
      },
      onCommand: options.onCommand,
      onChange: (active) => {
        this.world.canvas.classList.toggle('placing', active);
        if (active) this.cursor.set(null);
      },
    });
    this.world.scene.add(this.placement.object);

    const home = map.objects.find((o) => o.kind === 'spawn' && o.player === options.player);
    const rig = this.world.rig;
    rig.target.set(
      home ? home.x + home.w / 2 : map.width / 2,
      0,
      home ? home.y + home.h / 2 : map.height / 2,
    );
    rig.distance = DEFAULT_ZOOM;
    rig.update();

    this.camera = new CameraController(rig, this.world.canvas);
    this.minimap = new Minimap(map, 230, Math.sin(rig.pitch));
    this.minimap.onNavigate = (x, z) => {
      rig.target.set(x, 0, z);
      rig.pan(0, 0);
    };
    this.hud = new GameHud(
      container,
      map,
      this.minimap,
      options.warnings ?? [],
      {
        onCommand: options.onCommand,
        onSelectIdleWorker: () => this.selectIdleWorker(),
        onBeginRally: (id) => this.selection.beginRally(id),
        onStartPlacement: (type) => this.placement.begin(type),
        onBeginAttackMove: (ids) => this.selection.beginAttackMove(ids),
        onOpenMenu: () => this.openMenu(),
        onPlayAgain: () => options.controls.restart(),
        onMainMenu: () => options.controls.quit(),
      },
      options.rules,
    );
    this.speed = options.speed;
    this.settings = { ...options.settings };
    this.pauseMenu = new PauseMenu(this.hud.root, {
      speeds: options.speeds,
      speed: () => this.speed,
      settings: () => this.settings,
      onSpeed: (s) => this.setSpeed(s),
      onSettings: (s) => {
        this.applySettings(s);
        options.onSettings(s);
      },
      onResume: () => this.closeMenu(),
      onRestart: () => options.controls.restart(),
      onSurrender: () => {
        this.closeMenu(); // the command is applied at the next tick, so time must run
        options.onCommand({ type: 'surrender' });
      },
      onQuit: () => options.controls.quit(),
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
      isResource: (id) => {
        const v = this.lastView;
        if (v?.resources.has(id)) return true;
        const b = v?.buildings.find((x) => x.id === id);
        return !!b && b.owner === options.player && b.constructed && !!DATA.buildings[b.type]?.gather;
      },
      isEnemy: (id) => {
        const v = this.lastView;
        const owner =
          v?.units.find((u) => u.id === id)?.owner ?? v?.buildings.find((b) => b.id === id)?.owner;
        return owner !== undefined && owner !== options.player;
      },
      onCommand: options.onCommand,
      onMoveMarker: (x, z, color) => this.markers.spawn(x, z, color),
      onChange: () => {},
      onKey: (e) => {
        if (e.code === 'Period') {
          this.selectIdleWorker();
          return true;
        }
        if (e.code === 'KeyP' || e.code === 'Pause') {
          this.setPaused(!this.paused);
          return true;
        }
        if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') {
          this.stepSpeed(1);
          return true;
        }
        if (e.key === '-' || e.code === 'NumpadSubtract') {
          this.stepSpeed(-1);
          return true;
        }
        return this.hud.handleKey(e);
      },
      placement: this.placement,
      onEscape: () => {
        // cancel the build menu first; otherwise Esc opens the pause menu
        if (this.hud.isBuildMenuOpen) this.hud.toggleBuildMenu(false);
        else this.openMenu();
        return true;
      },
    });
    this.applySettings(this.settings);
    this.hud.setSpeed(this.speed, false);

    this.objectAt = new Int32Array(map.width * map.height).fill(-1);
    map.objects.forEach((o, i) => {
      for (let y = o.y; y < o.y + o.h; y++)
        for (let x = o.x; x < o.x + o.w; x++) this.objectAt[y * map.width + x] = i;
    });
  }

  /** One line about the opponent (the machine player's current plan), shown in the info box. */
  setOpponentStatus(text: string): void {
    this.hud.setOpponent(text);
  }

  /** Settings that act on the running match (camera, shadows, render quality, help-box lines). */
  applySettings(s: Settings): void {
    this.settings = { ...s };
    this.camera.edgeScroll = s.edgeScroll;
    this.camera.panSpeed = SCROLL_FACTOR[s.scrollSpeed];
    this.world.setShadows(s.shadows);
    this.world.setQuality(s.quality);
    this.hud.setVisibility(s.showFps, s.showAiStatus);
  }

  // ---- time control and the pause menu ----------------------------------------------------------

  private setPaused(paused: boolean): void {
    if (this.hud.resultVisible) paused = false;
    this.paused = paused;
    this.options.controls.setPaused(paused);
    this.hud.setSpeed(this.speed, paused, paused && !this.pauseMenu.isOpen);
  }

  private setSpeed(speed: number): void {
    this.speed = speed;
    this.options.controls.setSpeed(speed);
    this.hud.setSpeed(speed, this.paused, this.paused && !this.pauseMenu.isOpen);
  }

  private stepSpeed(dir: 1 | -1): void {
    const list = this.options.speeds;
    const i = list.indexOf(this.speed);
    const next = list[Math.max(0, Math.min(list.length - 1, (i < 0 ? list.indexOf(1) : i) + dir))];
    if (next !== undefined) this.setSpeed(next);
  }

  private openMenu(): void {
    if (this.hud.resultVisible || this.pauseMenu.isOpen) return;
    this.placement.cancel();
    this.camera.enabled = false;
    this.pauseMenu.open();
    this.setPaused(true);
  }

  private closeMenu(): void {
    this.pauseMenu.close();
    this.camera.enabled = true;
    this.setPaused(false);
  }

  /** Called by the host every animation frame. */
  frame(dtSeconds: number, view: PlayerView, alpha: number, events: readonly GameEvent[] = []): void {
    this.time += dtSeconds;
    this.lastView = view;
    if (view.result && !this.hud.resultVisible) {
      this.pauseMenu.close();
      this.camera.enabled = true;
      this.hud.showResult(view.result, view.player, TICK_RATE);
    }
    this.syncResources(view);
    this.showEvents(events);
    this.camera.update(dtSeconds);
    this.units.onEvents(events);
    this.buildings.onEvents(events);
    this.bars.begin();
    this.units.update(view, alpha, dtSeconds, this.selection.selected);
    this.buildings.update(view, this.selection.selected, dtSeconds);
    this.projectiles.update(view, alpha);
    this.effects.update(dtSeconds);
    this.bars.end(this.world.rig.camera);
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
      else if (e.type === 'buildingCompleted' && e.player === me)
        this.hud.message(`${displayName(e.buildingType)} finished`);
      else if (e.type === 'underAttack' && e.player === me) {
        this.hud.message('You are under attack!', 'warn');
        this.minimap.ping(e.x, e.y);
      } else if (e.type === 'buildingDestroyed')
        this.hud.message(
          e.owner === me
            ? `Your ${displayName(e.buildingType)} was destroyed`
            : `Enemy ${displayName(e.buildingType)} destroyed`,
          e.owner === me ? 'warn' : 'info',
        );
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

  /** A building may stand on this tile: buildable terrain, no boulder, resource or building. */
  private tileFree(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.map.width || y >= this.map.height) return false;
    const i = y * this.map.width + x;
    const terrain = this.map.terrain[i];
    if (!terrain || !BUILDABLE[terrain]) return false;
    const object = this.map.objects[this.objectAt[i] ?? -1];
    if (object?.kind === 'stone') return false;
    if (this.nodeAtTile.has(tileKey(x, y))) return false;
    return !this.lastView?.buildings.some((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
  }

  private updateHover(): void {
    const ndc = this.camera.overCanvas ? this.camera.pointerNdc() : null;
    const hit = ndc ? this.world.rig.groundAt(ndc.x, ndc.y) : null;
    if (this.placement.active) {
      this.placement.update(hit ? { x: hit.x, z: hit.z } : null);
      this.cursor.set(null);
      return;
    }
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
