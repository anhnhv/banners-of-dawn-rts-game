/**
 * STYLE PREVIEW: a hand-placed diorama to review the visual direction before building the
 * real map/engine rendering (M1+). Voxel/low-poly models with pixel textures, 3D lighting and
 * shadows, a fixed 45° RTS camera, and the planned HUD layout.
 *
 * This is NOT gameplay: nothing here talks to the engine yet.
 */
import * as THREE from 'three';
import { Rng } from '../../shared';
import {
  buildingGeometry,
  buildUnit,
  meshFrom,
  rockGeometry,
  treeGeometry,
  wallGeometry,
  type BuildingModel,
  type TreeModel,
  type UnitModel,
  type UnitParts,
} from '../art/models';
import { hex, type TeamName } from '../art/palette';
import { voxelMaterial } from '../art/materials';
import { buildTerrain, type TerrainGrid, type TerrainType, type TerrainView } from '../art/terrain';
import { PreviewHud } from '../hud/PreviewHud';
import { World3D } from '../three/World3D';

const W = 44;
const H = 40;
const EDGE_SCROLL_PX = 6;

interface Walker {
  unit: UnitParts;
  from: THREE.Vector3;
  to: THREE.Vector3;
  speed: number;
  t: number;
  phase: number;
}

interface Worker {
  unit: UnitParts;
  phase: number;
}

export class StylePreview {
  private readonly world: World3D;
  private readonly hud: PreviewHud;
  private readonly terrain: TerrainView;
  private readonly grid: TerrainGrid;
  private readonly occupied = new Uint8Array(W * H);
  private readonly walkers: Walker[] = [];
  private readonly workers: Worker[] = [];
  private readonly idlers: UnitParts[] = [];
  private readonly rng = new Rng(20261106);
  private readonly keys = new Set<string>();
  private pointer: { x: number; y: number } | null = null;
  private dragging: { x: number; y: number } | null = null;
  private time = 0;
  private last = 0;
  private fpsFrames = 0;
  private fpsTime = 0;
  private rafId = 0;

  constructor(container: HTMLElement) {
    this.world = new World3D(container, { minX: 0, maxX: W, minZ: 0, maxZ: H });
    const params = new URLSearchParams(window.location.search);
    this.setView(params.get('view') ?? '1');

    this.grid = this.makeTerrainGrid();
    this.terrain = buildTerrain(this.grid, 7);
    this.world.scene.add(this.terrain.group);

    this.placeBase();
    this.placeEnemy();
    this.placeForest();
    this.placeUnits();

    this.hud = new PreviewHud(container, this.makeMinimap());
    this.bindInput();
  }

  start(): void {
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    cancelAnimationFrame(this.rafId);
  }

  // ---- scene ------------------------------------------------------------------------------------

  private makeTerrainGrid(): TerrainGrid {
    const tiles: TerrainType[] = new Array<TerrainType>(W * H).fill('grass');
    const set = (x: number, z: number, t: TerrainType): void => {
      if (x >= 0 && z >= 0 && x < W && z < H) tiles[z * W + x] = t;
    };
    for (let x = 0; x < W; x++) {
      const center = 7 + 1.6 * Math.sin(x * 0.23);
      for (let z = 0; z < H; z++) {
        if (Math.abs(z + 0.5 - center) < 1.7) set(x, z, x === 21 || x === 22 ? 'sand' : 'water');
        const dx = (x + 0.5 - 22.5) / 10.5;
        const dz = (z + 0.5 - 26.5) / 8;
        if (dx * dx + dz * dz < 1) set(x, z, 'sand');
      }
    }
    for (let z = 9; z < 19; z++) {
      set(21, z, 'dirt');
      set(22, z, 'dirt');
    }
    for (let i = 0; i < 26; i++) {
      const x = this.rng.int(0, W - 1);
      const z = this.rng.int(10, H - 1);
      if (tiles[z * W + x] === 'grass') {
        set(x, z, 'dirt');
        if (this.rng.chance(0.6)) set(x + 1, z, 'dirt');
      }
    }
    return { width: W, height: H, tiles };
  }

  private occupy(x: number, z: number, w: number, d: number): void {
    for (let j = z; j < z + d; j++)
      for (let i = x; i < x + w; i++) if (i >= 0 && j >= 0 && i < W && j < H) this.occupied[j * W + i] = 1;
  }

  private addBuilding(model: BuildingModel, team: TeamName, x: number, z: number, size: number): THREE.Mesh {
    const mesh = meshFrom(buildingGeometry(model, team));
    mesh.position.set(x, 0, z);
    this.world.scene.add(mesh);
    this.occupy(x - 1, z - 1, size + 2, size + 2);
    return mesh;
  }

  private placeBase(): void {
    this.addBuilding('townHall', 'blue', 21, 24, 3);
    this.addBuilding('house', 'blue', 16, 22, 2);
    this.addBuilding('house', 'blue', 15, 26, 2);
    this.addBuilding('house', 'blue', 28, 21, 2);
    this.addBuilding('house', 'blue', 29, 30, 2);
    const barracks = this.addBuilding('barracks', 'blue', 25, 28, 3);
    this.addBuilding('farm', 'blue', 12, 30, 2);
    this.addBuilding('farm', 'blue', 15, 31, 2);
    this.addBuilding('goldMine', 'blue', 32, 24, 2);
    for (const [x, z] of [
      [17, 19],
      [18, 19],
      [17, 20],
    ] as const)
      this.addBuilding('berryBush', 'blue', x, z, 1);

    // selection outline around the barracks
    this.world.scene.add(footprintOutline(barracks.position.x, barracks.position.z, 3, '#7dff6a'));

    // wall along z = 17 with a gate gap at x = 21..22, towers at the ends and at the gate
    const wallX = wallGeometry('x');
    for (let x = 10; x <= 34; x++) {
      if (x === 21 || x === 22) continue;
      if (x === 10 || x === 20 || x === 23 || x === 34) {
        const tower = meshFrom(buildingGeometry('tower', 'blue'));
        tower.position.set(x, 0, 17);
        this.world.scene.add(tower);
      } else {
        const seg = meshFrom(wallX);
        seg.position.set(x, 0, 17);
        this.world.scene.add(seg);
      }
      this.occupy(x, 16, 1, 3);
    }
    this.occupy(20, 9, 4, 10); // keep the path to the ford clear
  }

  private placeEnemy(): void {
    this.addBuilding('tower', 'red', 13, 2, 1);
    this.addBuilding('house', 'red', 16, 0, 2);
    this.addBuilding('barracks', 'red', 27, 0, 3);
    this.addBuilding('tower', 'red', 31, 3, 1);
  }

  private placeForest(): void {
    const variants: TreeModel[] = ['oak', 'oakTall', 'pine', 'pineSmall'];
    const matrices = new Map<TreeModel, THREE.Matrix4[]>(variants.map((v) => [v, []]));
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);

    for (let z = 0; z < H; z++) {
      for (let x = 0; x < W; x++) {
        const i = z * W + x;
        if (this.occupied[i] || this.grid.tiles[i] !== 'grass') continue;
        const dx = (x - 22.5) / 14;
        const dz = (z - 26) / 11;
        const fromBase = Math.sqrt(dx * dx + dz * dz);
        const clump = 0.5 + 0.5 * Math.sin(x * 0.55) * Math.cos(z * 0.47);
        const chance = fromBase > 1 ? 0.35 + 0.5 * clump : z < 16 && z > 9 ? 0.25 * clump : 0.04;
        if (!this.rng.chance(chance)) continue;
        const r = this.rng.next();
        const variant: TreeModel = r < 0.32 ? 'pine' : r < 0.5 ? 'pineSmall' : r < 0.8 ? 'oak' : 'oakTall';
        p.set(x + 0.5 + this.rng.range(-0.15, 0.15), 0, z + 0.5 + this.rng.range(-0.15, 0.15));
        q.setFromAxisAngle(up, (this.rng.int(0, 3) * Math.PI) / 2);
        const k = this.rng.range(0.85, 1.15);
        s.set(k, k * this.rng.range(0.9, 1.1), k);
        matrices.get(variant)?.push(m.compose(p, q, s).clone());
      }
    }

    for (const variant of variants) {
      const list = matrices.get(variant) ?? [];
      if (list.length === 0) continue;
      const built = treeGeometry(variant);
      const mesh = new THREE.InstancedMesh(
        built.geometry,
        built.textures.map((t) => voxelMaterial(t)),
        list.length,
      );
      list.forEach((matrix, idx) => mesh.setMatrixAt(idx, matrix));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      this.world.scene.add(mesh);
    }

    // a few rocks for decoration
    const rock = rockGeometry();
    for (const [x, z, r] of [
      [9.4, 21.2, 0.4],
      [35.6, 27.5, 1.2],
      [19.2, 34.6, 2.1],
      [6.5, 12.5, 0.2],
      [38.3, 13.4, 1.7],
    ] as const) {
      const mesh = meshFrom(rock);
      mesh.position.set(x, 0, z);
      mesh.rotation.y = r;
      this.world.scene.add(mesh);
    }
  }

  private spawn(model: UnitModel, team: TeamName, x: number, z: number, facing: number): UnitParts {
    const unit = buildUnit(model, team);
    unit.group.position.set(x, 0, z);
    unit.group.rotation.y = facing;
    this.world.scene.add(unit.group);
    return unit;
  }

  private placeUnits(): void {
    // militia formation in front of the barracks, front row selected
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const u = this.spawn('militia', 'blue', 24.6 + col * 0.72, 32.1 + row * 0.7, Math.PI * 0.25);
        this.idlers.push(u);
        if (row === 0) this.world.scene.add(selectionRing(u.group.position.x, u.group.position.z));
      }
    }
    // workers: chopping wood, mining gold, farming
    for (const [x, z, f] of [
      [10.6, 24.2, -Math.PI / 2],
      [10.9, 26.6, -Math.PI / 2],
      [31.6, 26.6, Math.PI],
      [33.1, 26.7, Math.PI],
      [13.4, 32.4, 0],
    ] as const) {
      this.workers.push({ unit: this.spawn('worker', 'blue', x, z, f), phase: this.rng.range(0, 6) });
    }
    // archers on watch at the gate, a knight in the plaza
    this.idlers.push(this.spawn('archer', 'blue', 20.5, 19.0, Math.PI));
    this.idlers.push(this.spawn('archer', 'blue', 23.5, 19.0, Math.PI));
    this.idlers.push(this.spawn('archer', 'blue', 19.6, 19.4, Math.PI));
    this.idlers.push(this.spawn('knight', 'blue', 19.4, 22.8, Math.PI * 0.75));

    // a worker walking between the gold mine and the town hall
    this.addWalker('worker', 'blue', new THREE.Vector3(31.2, 0, 26.2), new THREE.Vector3(24.6, 0, 26.6), 1.2);

    // the red army marching to the ford and back
    const offsets: Array<[UnitModel, number, number]> = [
      ['knight', -0.4, 0],
      ['knight', 0.5, 0],
      ['militia', -0.7, -0.8],
      ['militia', 0.0, -0.8],
      ['militia', 0.7, -0.8],
      ['militia', -0.7, -1.5],
      ['militia', 0.0, -1.5],
      ['militia', 0.7, -1.5],
      ['archer', -0.35, -2.2],
      ['archer', 0.35, -2.2],
    ];
    for (const [model, ox, oz] of offsets) {
      this.addWalker(
        model,
        'red',
        new THREE.Vector3(22 + ox, 0, 1.5 + oz + 2.5),
        new THREE.Vector3(22 + ox, 0, 12.5 + oz),
        model === 'knight' ? 1.0 : 1.0,
      );
    }
  }

  private addWalker(
    model: UnitModel,
    team: TeamName,
    from: THREE.Vector3,
    to: THREE.Vector3,
    speed: number,
  ): void {
    const unit = this.spawn(model, team, from.x, from.z, 0);
    this.walkers.push({ unit, from, to, speed, t: 0, phase: this.rng.range(0, 6) });
  }

  private makeMinimap(): HTMLCanvasElement {
    const scale = 3;
    const canvas = document.createElement('canvas');
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available.');
    const colors: Record<TerrainType, string> = {
      grass: hex('grass'),
      dirt: hex('dirt'),
      sand: hex('sand'),
      water: hex('water'),
    };
    for (let z = 0; z < H; z++) {
      for (let x = 0; x < W; x++) {
        ctx.fillStyle = colors[this.grid.tiles[z * W + x] ?? 'grass'];
        ctx.fillRect(x * scale, z * scale, scale, scale);
      }
    }
    const mark = (x: number, z: number, w: number, d: number, color: string): void => {
      ctx.fillStyle = color;
      ctx.fillRect(x * scale, z * scale, w * scale, d * scale);
    };
    for (const [x, z, s] of [
      [21, 24, 3],
      [16, 22, 2],
      [15, 26, 2],
      [28, 21, 2],
      [29, 30, 2],
      [25, 28, 3],
    ] as const)
      mark(x, z, s, s, '#3d6fe0');
    mark(10, 17, 25, 1, '#9aa3c0');
    for (const [x, z, s] of [
      [13, 2, 1],
      [16, 0, 2],
      [27, 0, 3],
      [31, 3, 1],
    ] as const)
      mark(x, z, s, s, '#d23f36');
    canvas.style.width = `${W * 3}px`;
    canvas.style.height = `${H * 3}px`;
    return canvas;
  }

  // ---- loop -------------------------------------------------------------------------------------

  private readonly frame = (now: number): void => {
    const dt = this.last === 0 ? 0 : Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    this.time += dt;
    this.updateCamera(dt);
    this.animate(dt);
    this.terrain.update(this.time);
    const stats = this.world.render();

    this.fpsFrames++;
    this.fpsTime += dt;
    if (this.fpsTime >= 0.5) {
      this.hud.setStats(Math.round(this.fpsFrames / this.fpsTime), stats.drawCalls, stats.triangles);
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }
    this.rafId = requestAnimationFrame(this.frame);
  };

  private animate(dt: number): void {
    const t = this.time;
    for (const w of this.walkers) {
      const len = w.from.distanceTo(w.to);
      w.t += (dt * w.speed) / len;
      const cycle = w.t % 2;
      const forward = cycle < 1;
      const k = forward ? cycle : 2 - cycle;
      w.unit.group.position.lerpVectors(w.from, w.to, k);
      const dir = forward ? w.to.clone().sub(w.from) : w.from.clone().sub(w.to);
      w.unit.group.rotation.y = Math.atan2(dir.x, dir.z);
      swingLegs(w.unit, t * 9 + w.phase, 0.7);
      w.unit.group.position.y = Math.abs(Math.sin(t * 9 + w.phase)) * 0.025;
    }
    for (const w of this.workers) {
      const chop = Math.max(0, Math.sin(t * 5 + w.phase));
      w.unit.group.rotation.x = chop * chop * 0.22;
    }
    for (const [i, u] of this.idlers.entries()) {
      u.group.position.y = Math.max(0, Math.sin(t * 2 + i * 0.9)) * 0.012;
    }
  }

  // ---- input ------------------------------------------------------------------------------------

  /** Camera presets: 1 = base overview, 2 = barracks + army close-up, 3 = enemy at the ford. */
  private setView(view: string): void {
    const views: Record<string, [number, number, number]> = {
      '1': [24.5, 27.5, 22],
      '2': [26.2, 31.6, 11],
      '3': [21.5, 9.5, 14],
    };
    const [x, z, distance] = views[view] ?? views['1'] ?? [22, 26, 22];
    this.world.rig.target.set(x, 0, z);
    this.world.rig.distance = distance;
    this.world.rig.update();
  }

  private bindInput(): void {
    const canvas = this.world.canvas;
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.key);
      if (e.key === '1' || e.key === '2' || e.key === '3') this.setView(e.key);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key));
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('pointermove', (e) => {
      this.pointer = { x: e.clientX, y: e.clientY };
      if (this.dragging) {
        const wpp = this.world.rig.worldPerPixel(window.innerHeight);
        const pitch = Math.sin(this.world.rig.pitch);
        this.world.rig.pan(
          -(e.clientX - this.dragging.x) * wpp,
          ((e.clientY - this.dragging.y) * wpp) / pitch,
        );
        this.dragging = { x: e.clientX, y: e.clientY };
      }
    });
    document.addEventListener('pointerleave', () => (this.pointer = null));
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button === 1) {
        e.preventDefault();
        this.dragging = { x: e.clientX, y: e.clientY };
      }
    });
    window.addEventListener('pointerup', () => (this.dragging = null));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.world.rig.zoom(Math.exp(e.deltaY * 0.0012));
      },
      { passive: false },
    );
  }

  private updateCamera(dt: number): void {
    const speed = this.world.rig.distance * 0.9 * dt;
    let dx = 0;
    let dy = 0;
    if (this.keys.has('ArrowLeft')) dx -= 1;
    if (this.keys.has('ArrowRight')) dx += 1;
    if (this.keys.has('ArrowUp')) dy += 1;
    if (this.keys.has('ArrowDown')) dy -= 1;
    const p = this.pointer;
    if (p && !this.dragging) {
      if (p.x <= EDGE_SCROLL_PX) dx -= 1;
      if (p.x >= window.innerWidth - EDGE_SCROLL_PX) dx += 1;
      if (p.y <= EDGE_SCROLL_PX) dy += 1;
      if (p.y >= window.innerHeight - EDGE_SCROLL_PX) dy -= 1;
    }
    if (dx !== 0 || dy !== 0) this.world.rig.pan(dx * speed, dy * speed);
  }
}

function swingLegs(unit: UnitParts, phase: number, amount: number): void {
  unit.legs.forEach((leg, i) => {
    const sign = i % 2 === 0 ? 1 : -1;
    // horses (4 legs) move diagonal pairs together
    const pair = unit.legs.length === 4 ? (i === 0 || i === 3 ? 1 : -1) : sign;
    leg.rotation.x = Math.sin(phase) * amount * pair;
  });
}

function selectionRing(x: number, z: number): THREE.Mesh {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.24, 0.31, 20),
    new THREE.MeshBasicMaterial({ color: '#7dff6a', transparent: true, opacity: 0.95, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, 0.02, z);
  ring.renderOrder = 2;
  return ring;
}

function footprintOutline(x: number, z: number, size: number, color: string): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color });
  const t = 0.07;
  const bar = (bx: number, bz: number, w: number, d: number): void => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), material);
    m.position.set(bx + w / 2, 0.02, bz + d / 2);
    group.add(m);
  };
  bar(x - 0.05, z - 0.05, size + 0.1, t);
  bar(x - 0.05, z + size - 0.02, size + 0.1, t);
  bar(x - 0.05, z - 0.05, t, size + 0.1);
  bar(x + size - 0.02, z - 0.05, t, size + 0.1);
  return group;
}
