/**
 * Draws projectiles in flight (PLAN §7.9): one instanced mesh per projectile model
 * (projectiles.json → model), interpolated between ticks and pointed along its flight.
 */
import * as THREE from 'three';
import type { PlayerView } from '../../shared';
import { voxelMaterial } from '../art/materials';
import { projectileGeometry } from '../art/models';
import { DATA } from '../data';

const tmpM = new THREE.Matrix4();
const tmpPos = new THREE.Vector3();
const tmpDir = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const ONE = new THREE.Vector3(1, 1, 1);
const FORWARD = new THREE.Vector3(0, 0, 1);

export class ProjectileRenderer {
  readonly group = new THREE.Group();
  private readonly meshes = new Map<string, { mesh: THREE.InstancedMesh; capacity: number }>();

  constructor() {
    this.group.name = 'projectiles';
  }

  update(view: PlayerView, alpha: number): void {
    const counts = new Map<string, number>();
    for (const p of view.projectiles) {
      const model = DATA.projectiles[p.kind]?.model ?? 'arrow';
      counts.set(model, (counts.get(model) ?? 0) + 1);
    }
    for (const [model, n] of counts) this.ensure(model, n);
    const used = new Map<string, number>();
    for (const p of view.projectiles) {
      const model = DATA.projectiles[p.kind]?.model ?? 'arrow';
      const entry = this.meshes.get(model);
      if (!entry) continue;
      const i = used.get(model) ?? 0;
      used.set(model, i + 1);
      tmpPos.set(
        p.prevX + (p.x - p.prevX) * alpha,
        p.prevZ + (p.z - p.prevZ) * alpha,
        p.prevY + (p.y - p.prevY) * alpha,
      );
      tmpDir.set(p.x - p.prevX, p.z - p.prevZ, p.y - p.prevY);
      if (tmpDir.lengthSq() > 1e-8) tmpQuat.setFromUnitVectors(FORWARD, tmpDir.normalize());
      tmpM.compose(tmpPos, tmpQuat, ONE);
      entry.mesh.setMatrixAt(i, tmpM);
    }
    for (const [model, entry] of this.meshes) {
      entry.mesh.count = used.get(model) ?? 0;
      entry.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  private ensure(model: string, n: number): void {
    const entry = this.meshes.get(model);
    if (entry && entry.capacity >= n) return;
    let capacity = entry?.capacity ?? 32;
    while (capacity < n) capacity *= 2;
    if (entry) {
      this.group.remove(entry.mesh);
      entry.mesh.dispose();
    }
    const built = projectileGeometry(model);
    const mesh = new THREE.InstancedMesh(
      built.geometry,
      built.textures.map((t) => voxelMaterial(t)),
      capacity,
    );
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    this.group.add(mesh);
    this.meshes.set(model, { mesh, capacity });
  }
}
