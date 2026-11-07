/**
 * HP bars (PLAN §7.9), shared by units and buildings: two instanced quads per bar (dark back and a
 * colored fill that shrinks from the right), always facing the camera. Green above 60%, yellow
 * above 30%, red below. Call begin(), add() per bar, end(camera) once per frame.
 */
import * as THREE from 'three';

const HEIGHT = 0.07;
const PAD = 0.025;

const tmpM = new THREE.Matrix4();
const tmpLocal = new THREE.Matrix4();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3();
const tmpColor = new THREE.Color();
const IDENTITY = new THREE.Quaternion();

interface Bar {
  x: number;
  y: number;
  z: number;
  width: number;
  frac: number;
}

export class HealthBars {
  readonly group = new THREE.Group();
  private back: THREE.InstancedMesh;
  private fill: THREE.InstancedMesh;
  private capacity = 64;
  private readonly bars: Bar[] = [];

  constructor() {
    this.group.name = 'hp-bars';
    [this.back, this.fill] = this.make(this.capacity);
  }

  begin(): void {
    this.bars.length = 0;
  }

  /** A bar centered at (x, y, z) in world space. */
  add(x: number, y: number, z: number, width: number, frac: number): void {
    this.bars.push({ x, y, z, width, frac: Math.max(0, Math.min(1, frac)) });
  }

  end(camera: THREE.Camera): void {
    if (this.bars.length > this.capacity) {
      while (this.capacity < this.bars.length) this.capacity *= 2;
      for (const m of [this.back, this.fill]) {
        this.group.remove(m);
        m.dispose();
      }
      [this.back, this.fill] = this.make(this.capacity);
    }
    const q = camera.quaternion;
    this.bars.forEach((b, i) => {
      tmpPos.set(b.x, b.y, b.z);
      tmpM.compose(tmpPos, q, tmpScale.set(b.width + PAD * 2, HEIGHT + PAD * 2, 1));
      this.back.setMatrixAt(i, tmpM);
      // fill: left-anchored quad [0..1] in x, shifted to the bar's left edge
      tmpM.compose(tmpPos, q, tmpScale.set(1, 1, 1));
      tmpLocal.compose(
        new THREE.Vector3(-b.width / 2, 0, 0.002),
        IDENTITY,
        tmpScale.set(Math.max(0.001, b.width * b.frac), HEIGHT, 1),
      );
      this.fill.setMatrixAt(i, tmpM.multiply(tmpLocal));
      this.fill.setColorAt(i, tmpColor.set(b.frac > 0.6 ? '#6fe05a' : b.frac > 0.3 ? '#f2c94c' : '#e8503a'));
    });
    this.back.count = this.bars.length;
    this.fill.count = this.bars.length;
    this.back.instanceMatrix.needsUpdate = true;
    this.fill.instanceMatrix.needsUpdate = true;
    if (this.fill.instanceColor) this.fill.instanceColor.needsUpdate = true;
  }

  private make(capacity: number): [THREE.InstancedMesh, THREE.InstancedMesh] {
    const mk = (geometry: THREE.BufferGeometry, color: string, order: number): THREE.InstancedMesh => {
      const material = new THREE.MeshBasicMaterial({
        color,
        depthTest: false,
        depthWrite: false,
        transparent: true,
      });
      const m = new THREE.InstancedMesh(geometry, material, capacity);
      m.count = 0;
      m.frustumCulled = false;
      m.renderOrder = order;
      this.group.add(m);
      return m;
    };
    const back = mk(new THREE.PlaneGeometry(1, 1), '#14111c', 10);
    const fill = mk(new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0), '#ffffff', 11);
    fill.setColorAt(0, tmpColor.set('#ffffff'));
    return [back, fill];
  }
}
