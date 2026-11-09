/**
 * MODEL VIEWER (`/?models`, PLAN §7.8 / M10): every voxel model on a slow turntable with its name,
 * in both team colors, plus every HUD icon, so the art can be reviewed in one place.
 * Arrows / edge / middle-drag pan, wheel zooms. Nothing here talks to the engine.
 */
import * as THREE from 'three';
import { DATA, displayName } from '../data';
import {
  buildingGeometry,
  buildUnit,
  constructionSiteGeometry,
  meshFrom,
  projectileGeometry,
  rockGeometry,
  rubbleGeometry,
  treeGeometry,
  wallGeometry,
  type BuildingModel,
  type TreeModel,
  type UnitModel,
} from '../art/models';
import type { BuiltGeometry } from '../art/VoxelBuilder';
import { VoxelBuilder } from '../art/VoxelBuilder';
import { resolveColor } from '../art/palette';
import { iconImg, iconNames } from '../hud/pixelIcons';
import { CameraController } from '../input/CameraController';
import { World3D } from '../three/World3D';

const SPACING = 4.2;
const ROW = 5.2;
/** Screen-right and screen-down directions on the ground for the fixed 45° camera. */
const RIGHT = new THREE.Vector3(1, 0, -1).normalize();
const DOWN = new THREE.Vector3(1, 0, 1).normalize();

interface Item {
  pivot: THREE.Group;
  label: HTMLElement;
  height: number;
}

/** A mesh re-centered on its footprint so it spins in place. */
function centered(object: THREE.Object3D): THREE.Group {
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  object.position.x -= center.x;
  object.position.z -= center.z;
  const pivot = new THREE.Group();
  pivot.add(object);
  pivot.userData.height = box.max.y;
  return pivot;
}

function geometryMesh(g: BuiltGeometry): THREE.Mesh {
  return meshFrom(g);
}

export class ModelViewer {
  private readonly world: World3D;
  private readonly camera: CameraController;
  private readonly items: Item[] = [];
  private readonly labels: HTMLElement;
  private last = 0;
  private time = 0;
  private rafId = 0;

  constructor(container: HTMLElement) {
    const rows = this.rows();
    const cols = Math.max(...rows.map((r) => r.entries.length));
    this.world = new World3D(container, { minX: -20, maxX: 60, minZ: -20, maxZ: 60 });
    this.labels = document.createElement('div');
    this.labels.className = 'viewer-labels';
    container.append(this.labels);

    const ground = new VoxelBuilder()
      .box(-30, -0.1, -30, 100, 0.1, 100, 'plain', resolveColor('grass', 'blue'))
      .build();
    const groundMesh = meshFrom(ground);
    groundMesh.castShadow = false;
    this.world.scene.add(groundMesh);

    const origin = new THREE.Vector3(8, 0, 8);
    rows.forEach((row, r) => {
      const heading = document.createElement('div');
      heading.className = 'viewer-row';
      heading.textContent = row.title;
      const anchor = new THREE.Group();
      anchor.position
        .copy(origin)
        .addScaledVector(RIGHT, -SPACING * 0.9)
        .addScaledVector(DOWN, r * ROW);
      this.world.scene.add(anchor);
      this.items.push({ pivot: anchor, label: heading, height: 0 });
      this.labels.append(heading);
      row.entries.forEach(([name, object], i) => {
        const pivot = centered(object);
        pivot.position
          .copy(origin)
          .addScaledVector(RIGHT, i * SPACING)
          .addScaledVector(DOWN, r * ROW);
        pivot.rotation.y = i * 0.7;
        this.world.scene.add(pivot);
        const label = document.createElement('div');
        label.className = 'viewer-label';
        label.textContent = name;
        this.labels.append(label);
        this.items.push({ pivot, label, height: Number(pivot.userData.height) || 1 });
      });
    });

    const rig = this.world.rig;
    rig.target
      .copy(origin)
      .addScaledVector(RIGHT, ((cols - 1) * SPACING) / 2)
      .addScaledVector(DOWN, ROW * 1.5);
    rig.distance = 40;
    rig.update();
    this.camera = new CameraController(rig, this.world.canvas);
    container.append(this.iconPanel());
  }

  start(): void {
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    cancelAnimationFrame(this.rafId);
  }

  private rows(): Array<{ title: string; entries: Array<[string, THREE.Object3D]> }> {
    const buildings: Array<[string, BuildingModel]> = [
      ...Object.entries(DATA.buildings).map(([, d]) => [d.name, d.model] as [string, BuildingModel]),
      ['Farm (unused)', 'farm'],
    ];
    const nodes: Array<[string, BuildingModel]> = [
      [displayName('gold_mine'), 'goldMine'],
      [displayName('berry_bush'), 'berryBush'],
    ];
    const units = Object.entries(DATA.units).map(([, d]) => [d.name, d.model as UnitModel] as const);
    const trees: Array<[string, TreeModel]> = [
      ['Oak', 'oak'],
      ['Tall oak', 'oakTall'],
      ['Pine', 'pine'],
      ['Small pine', 'pineSmall'],
    ];
    const unitRow = (team: 'blue' | 'red'): Array<[string, THREE.Object3D]> =>
      units.map(([name, model]) => {
        const group = buildUnit(model, team).group;
        group.scale.setScalar(2.2);
        return [name, group];
      });
    return [
      {
        title: 'Buildings',
        entries: buildings.map(([n, m]) => [n, geometryMesh(buildingGeometry(m, 'blue'))]),
      },
      { title: 'Units ×2.2 (you)', entries: unitRow('blue') },
      { title: 'Units ×2.2 (machine)', entries: unitRow('red') },
      {
        title: 'Resources',
        entries: [
          ...nodes.map(([n, m]): [string, THREE.Object3D] => [n, geometryMesh(buildingGeometry(m, 'blue'))]),
          ...trees.map(([n, m]): [string, THREE.Object3D] => {
            const mesh = geometryMesh(treeGeometry(m));
            mesh.scale.setScalar(1.6);
            return [n, mesh];
          }),
          ['Boulder', geometryMesh(rockGeometry())],
        ],
      },
      {
        title: 'Other',
        entries: [
          ['Construction site', geometryMesh(constructionSiteGeometry(3, 3, 1.1))],
          ['Rubble', geometryMesh(rubbleGeometry(3, 3))],
          ['Wall (unused)', geometryMesh(wallGeometry('x'))],
          ['Arrow ×4', scaled(geometryMesh(projectileGeometry('arrow')), 4)],
          ['Stone ×4', scaled(geometryMesh(projectileGeometry('stone')), 4)],
        ],
      },
    ];
  }

  private iconPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'viewer-icons panel';
    const title = document.createElement('div');
    title.className = 'info-title';
    title.textContent = 'HUD icons';
    panel.append(title);
    const grid = document.createElement('div');
    grid.className = 'viewer-icon-grid';
    for (const name of iconNames()) {
      const cell = document.createElement('div');
      cell.className = 'viewer-icon';
      const caption = document.createElement('span');
      caption.textContent = name;
      cell.append(iconImg(name), caption);
      grid.append(cell);
    }
    panel.append(grid);
    const help = document.createElement('div');
    help.className = 'viewer-help';
    help.textContent = 'Arrows / screen edge / middle-drag: pan · wheel: zoom';
    panel.append(help);
    return panel;
  }

  private readonly frame = (now: number): void => {
    const dt = this.last === 0 ? 0 : Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    this.time += dt;
    this.camera.update(dt);
    const cam = this.world.rig.camera;
    const w = this.world.canvas.clientWidth;
    const h = this.world.canvas.clientHeight;
    const p = new THREE.Vector3();
    for (const item of this.items) {
      if (item.height > 0) item.pivot.rotation.y += dt * 0.5;
      p.copy(item.pivot.position);
      p.y = item.height > 0 ? -0.15 : 0;
      p.project(cam);
      const visible = p.z < 1 && Math.abs(p.x) < 1.2 && Math.abs(p.y) < 1.2;
      item.label.style.display = visible ? 'block' : 'none';
      if (visible)
        item.label.style.transform = `translate(${((p.x + 1) / 2) * w}px, ${((1 - p.y) / 2) * h}px) translate(-50%, 0)`;
    }
    this.world.render();
    this.rafId = requestAnimationFrame(this.frame);
  };
}

function scaled<T extends THREE.Object3D>(o: T, s: number): T {
  o.scale.setScalar(s);
  return o;
}
