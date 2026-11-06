/** Feedback for a move order: a green ring on the ground that shrinks and fades (PLAN §7.9). */
import * as THREE from 'three';

const LIFETIME = 0.6;

interface Marker {
  mesh: THREE.Mesh;
  age: number;
}

export class MoveMarkers {
  readonly group = new THREE.Group();
  private readonly pool: Marker[] = [];
  private readonly geometry = new THREE.RingGeometry(0.32, 0.42, 24).rotateX(-Math.PI / 2);

  spawn(x: number, z: number, color = '#7dff6a'): void {
    let m = this.pool.find((p) => p.age >= LIFETIME);
    if (!m) {
      const mesh = new THREE.Mesh(
        this.geometry,
        new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false }),
      );
      mesh.renderOrder = 3;
      this.group.add(mesh);
      m = { mesh, age: LIFETIME };
      this.pool.push(m);
    }
    (m.mesh.material as THREE.MeshBasicMaterial).color.set(color);
    m.mesh.position.set(x, 0.04, z);
    m.mesh.visible = true;
    m.age = 0;
  }

  update(dt: number): void {
    for (const m of this.pool) {
      if (m.age >= LIFETIME) continue;
      m.age += dt;
      const t = Math.min(1, m.age / LIFETIME);
      const s = 1.3 - t * 0.7;
      m.mesh.scale.set(s, 1, s);
      (m.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - t;
      if (t >= 1) m.mesh.visible = false;
    }
  }
}
