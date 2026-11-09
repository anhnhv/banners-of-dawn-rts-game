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
  projectileGeometry,
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
import { CameraController } from '../input/CameraController';
import { World3D } from '../three/World3D';

const W = 44;
const H = 40;

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

/** A soldier of the skirmish at the gate: lunges at the enemy in front of it. */
interface Fighter {
  unit: UnitParts;
  phase: number;
  facing: number;
}

/** An arrow looping from an archer on the wall to a target outside it. */
interface Volley {
  mesh: THREE.Mesh;
  from: THREE.Vector3;
  to: THREE.Vector3;
  offset: number;
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
  private readonly fighters: Fighter[] = [];
  private readonly volleys: Volley[] = [];
  private readonly rng = new Rng(20261106);
  private readonly camera: CameraController;
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
    this.placeSkirmish();

    this.hud = new PreviewHud(container, this.makeMinimap());
    // `&clean`: no HUD, for pictures (the Main Menu image assets/menu/hero.webp is taken this way)
    if (params.has('clean')) this.hud.root.style.display = 'none';
    this.camera = new CameraController(this.world.rig, this.world.canvas);
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
    this.addBuilding('farm', 'blue', 11, 29, 4);
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
      [13.2, 33.45, Math.PI],
    ] as const) {
      this.workers.push({ unit: this.spawn('worker', 'blue', x, z, f), phase: this.rng.range(0, 6) });
    }
    // archers on watch at the gate, a knight in the plaza
    this.idlers.push(this.spawn('archer', 'blue', 20.4, 22.2, Math.PI));
    this.idlers.push(this.spawn('archer', 'blue', 23.2, 22.4, Math.PI));
    this.idlers.push(this.spawn('archer', 'blue', 21.8, 22.8, Math.PI));
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
        new THREE.Vector3(22 + ox, 0, 10 + oz),
        model === 'knight' ? 1.0 : 1.0,
      );
    }
  }

  /**
   * A small fight at the gate: blue defenders against red raiders just outside the wall, two
   * fallen soldiers, and arrows from the archers behind the wall (for the Main Menu image).
   */
  private placeSkirmish(): void {
    // red raiders have broken through the gate; blue defenders meet them just inside the wall
    const north = Math.PI; // facing -z, toward the gate
    const fighters: Array<[UnitModel, TeamName, number, number, number]> = [
      ['knight', 'blue', 19.9, 19.9, north + 0.35],
      ['militia', 'blue', 21.1, 19.8, north + 0.1],
      ['militia', 'blue', 22.3, 19.9, north - 0.1],
      ['militia', 'blue', 23.4, 19.6, north - 0.45],
      ['militia', 'red', 20.2, 18.8, 0.3],
      ['militia', 'red', 21.3, 18.7, 0.05],
      ['knight', 'red', 22.4, 18.6, -0.1],
      ['militia', 'red', 23.5, 18.7, -0.4],
      ['militia', 'red', 21.8, 17.9, 0],
    ];
    for (const [model, team, x, z, facing] of fighters)
      this.fighters.push({
        unit: this.spawn(model, team, x, z, facing),
        phase: this.rng.range(0, 6),
        facing,
      });

    // the fallen: tipped over on their side
    for (const [model, team, x, z, r] of [
      ['militia', 'red', 24.5, 19.4, 0.6],
      ['militia', 'blue', 19.0, 20.6, 2.2],
      ['militia', 'red', 20.9, 20.9, 4.0],
    ] as const) {
      const u = this.spawn(model, team, x, z, r);
      u.group.rotation.z = Math.PI / 2;
      u.group.position.y = 0.16;
    }

    // arrows from the archers behind the line to the raiders
    const arrow = projectileGeometry('arrow');
    for (const [fx, fz, tx, tz, offset] of [
      [20.4, 22.2, 21.3, 18.7, 0],
      [23.2, 22.4, 23.5, 18.7, 0.35],
      [21.8, 22.8, 22.4, 18.6, 0.7],
      [23.2, 22.4, 21.8, 17.9, 0.15],
      [20.4, 22.2, 20.2, 18.8, 0.55],
    ] as const) {
      const mesh = meshFrom(arrow);
      this.world.scene.add(mesh);
      this.volleys.push({
        mesh,
        from: new THREE.Vector3(fx, 0.9, fz),
        to: new THREE.Vector3(tx, 0.6, tz),
        offset,
      });
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
      shallow: hex('shallow'),
      water: hex('water'),
      rock: hex('stone-dark'),
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
    this.camera.update(dt);
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
    // the skirmish: quick lunges toward the enemy, out of step with each other
    for (const f of this.fighters) {
      const lunge = Math.max(0, Math.sin(t * 7 + f.phase));
      f.unit.group.rotation.x = lunge * lunge * 0.3;
      f.unit.group.rotation.y = f.facing + Math.sin(t * 3 + f.phase) * 0.08;
      swingLegs(f.unit, t * 4 + f.phase, 0.25);
    }
    // arrows: an arc from the wall to the target, then the next one
    const point = new THREE.Vector3();
    const ahead = new THREE.Vector3();
    for (const v of this.volleys) {
      const k = (t * 0.8 + v.offset) % 1;
      const at = (s: number, out: THREE.Vector3): THREE.Vector3 =>
        out.lerpVectors(v.from, v.to, s).setY(v.from.y + (v.to.y - v.from.y) * s + 1.4 * s * (1 - s));
      at(k, point);
      at(Math.min(1, k + 0.02), ahead);
      v.mesh.position.copy(point);
      v.mesh.lookAt(ahead);
    }
    for (const [i, u] of this.idlers.entries()) {
      u.group.position.y = Math.max(0, Math.sin(t * 2 + i * 0.9)) * 0.012;
    }
  }

  // ---- input ------------------------------------------------------------------------------------

  /**
   * Camera presets: 1 = base overview, 2 = barracks + army close-up, 3 = enemy at the ford,
   * hero = the wide view of the Main Menu image (`/?preview&view=hero&clean`, see MainMenu.ts).
   */
  private setView(view: string): void {
    const views: Record<string, [number, number, number]> = {
      '1': [24.5, 27.5, 22],
      '2': [26.2, 31.6, 11],
      '3': [21.5, 9.5, 14],
      hero: [22, 19, 27],
    };
    const [x, z, distance] = views[view] ?? views['1'] ?? [22, 26, 22];
    this.world.rig.target.set(x, 0, z);
    this.world.rig.distance = distance;
    this.world.rig.update();
  }

  private bindInput(): void {
    window.addEventListener('keydown', (e) => {
      if (e.key === '1' || e.key === '2' || e.key === '3') this.setView(e.key);
    });
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
