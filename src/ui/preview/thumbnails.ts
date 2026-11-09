/**
 * Still pictures of 3D models for the HUD gallery: one offscreen renderer draws any object from the
 * game camera's angle (45° yaw, 52° pitch) into a small transparent PNG.
 */
import * as THREE from 'three';
import { meshFrom, rockBlockGeometry } from '../art/models';
import { buildTerrain, type TerrainType } from '../art/terrain';
import type { BuiltGeometry } from '../art/VoxelBuilder';

const YAW = Math.PI / 4;
const PITCH = THREE.MathUtils.degToRad(52);
const FOV = 30;

export class Thumbnailer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 500);

  constructor(size = 160) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(size, size, false);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    const sun = new THREE.DirectionalLight('#fff1d6', 2.6);
    sun.position.set(-9, 22, 13);
    this.scene.add(new THREE.HemisphereLight('#e8f3ff', '#9c8a66', 1.7), sun);
  }

  /** PNG data URL of the object, framed to fill the picture. */
  shot(object: THREE.Object3D): string {
    this.scene.add(object);
    const sphere = new THREE.Box3().setFromObject(object).getBoundingSphere(new THREE.Sphere());
    const distance = (sphere.radius / Math.sin(THREE.MathUtils.degToRad(FOV / 2))) * 1.02;
    this.camera.position.set(
      sphere.center.x + Math.sin(YAW) * Math.cos(PITCH) * distance,
      sphere.center.y + Math.sin(PITCH) * distance,
      sphere.center.z + Math.cos(YAW) * Math.cos(PITCH) * distance,
    );
    this.camera.lookAt(sphere.center);
    this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL('image/png');
    this.scene.remove(object);
    return url;
  }

  /** Picture of a built geometry (buildings, trees, rocks, …). */
  shotGeometry(g: BuiltGeometry): string {
    const mesh = meshFrom(g);
    const url = this.shot(mesh);
    mesh.geometry.dispose();
    return url;
  }

  /** Picture of a small patch of one terrain type (rock tiles get their outcrops, as on the map). */
  shotTerrain(type: TerrainType, tiles = 3): string {
    const terrain = buildTerrain({
      width: tiles,
      height: tiles,
      tiles: Array<TerrainType>(tiles * tiles).fill(type),
    });
    const group = new THREE.Group();
    group.add(terrain.group);
    if (type === 'rock') {
      for (let y = 0; y < tiles; y++)
        for (let x = 0; x < tiles; x++) {
          const rock = meshFrom(rockBlockGeometry(((x + y * 2) % 3) as 0 | 1 | 2));
          rock.position.set(x + 0.5, 0, y + 0.5);
          rock.rotation.y = ((x * 3 + y) % 4) * (Math.PI / 2);
          group.add(rock);
        }
    }
    terrain.update(0);
    return this.shot(group);
  }
}
