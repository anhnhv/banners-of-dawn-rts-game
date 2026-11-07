/**
 * Particle effects (PLAN §7.9): hit sparks, dust puffs (deaths, destroyed buildings), fire and
 * smoke on burning buildings. One instanced cube mesh, per-instance color; particles shrink as
 * they age (no per-particle transparency needed).
 */
import * as THREE from 'three';

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  gravity: number;
  age: number;
  life: number;
  size: number;
  color: THREE.Color;
  /** Optional second color the particle fades to (fire → smoke). */
  to: THREE.Color | null;
}

const MAX = 900;
const tmpM = new THREE.Matrix4();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3();
const tmpColor = new THREE.Color();
const IDENTITY = new THREE.Quaternion();

export class Effects {
  readonly group = new THREE.Group();
  private readonly mesh: THREE.InstancedMesh;
  private readonly particles: Particle[] = [];
  /** Cheap deterministic-enough jitter (visual only). */
  private seed = 1;

  constructor() {
    this.group.name = 'effects';
    this.mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: '#ffffff' }),
      MAX,
    );
    this.mesh.setColorAt(0, tmpColor.set('#ffffff'));
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    this.group.add(this.mesh);
  }

  /** Hit sparks: a quick burst of bright chips. */
  sparks(x: number, y: number, z: number, count = 7): void {
    for (let i = 0; i < count; i++) {
      const a = this.rand() * Math.PI * 2;
      const s = 1.2 + this.rand() * 1.6;
      this.add(
        x,
        y,
        z,
        Math.cos(a) * s,
        1 + this.rand() * 1.8,
        Math.sin(a) * s,
        9,
        0.22 + this.rand() * 0.15,
        0.045,
        this.rand() < 0.5 ? '#fff2b0' : '#ffb347',
      );
    }
  }

  /** Dust puff on the ground, `radius` tiles wide. */
  dust(x: number, z: number, radius: number, count = 14): void {
    for (let i = 0; i < count; i++) {
      const a = this.rand() * Math.PI * 2;
      const r = this.rand() * radius;
      this.add(
        x + Math.cos(a) * r,
        0.1 + this.rand() * 0.3,
        z + Math.sin(a) * r,
        Math.cos(a) * 0.5,
        0.4 + this.rand() * 0.5,
        Math.sin(a) * 0.5,
        -0.3,
        0.7 + this.rand() * 0.6,
        0.12 + this.rand() * 0.12 * Math.max(1, radius),
        this.rand() < 0.5 ? '#a08a6a' : '#c8b694',
      );
    }
  }

  /** A few flame bits rising into smoke (call each frame for a burning spot; dt-scaled). */
  fire(x: number, y: number, z: number, dt: number, intensity = 1): void {
    const rate = dt * 18 * intensity; // particles this frame (fractional part by chance)
    const n = Math.floor(rate) + (this.rand() < rate % 1 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const p = this.add(
        x + (this.rand() - 0.5) * 0.3,
        y,
        z + (this.rand() - 0.5) * 0.3,
        (this.rand() - 0.5) * 0.15,
        0.7 + this.rand() * 0.5,
        (this.rand() - 0.5) * 0.15,
        -0.2,
        0.9 + this.rand() * 0.6,
        0.08 + this.rand() * 0.06,
        this.rand() < 0.5 ? '#ff8a2a' : '#ffd25a',
      );
      if (p) p.to = new THREE.Color('#3a3538');
    }
  }

  update(dt: number): void {
    let n = 0;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i] as Particle;
      p.age += dt;
      if (p.age >= p.life) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy -= p.gravity * dt;
      p.x += p.vx * dt;
      p.y = Math.max(0.02, p.y + p.vy * dt);
      p.z += p.vz * dt;
      const k = p.age / p.life;
      const size = p.size * (p.to ? 0.6 + k * 1.2 : 1 - k * 0.8);
      tmpM.compose(tmpPos.set(p.x, p.y, p.z), IDENTITY, tmpScale.set(size, size, size));
      this.mesh.setMatrixAt(n, tmpM);
      tmpColor.copy(p.color);
      if (p.to) tmpColor.lerp(p.to, Math.min(1, k * 1.6));
      this.mesh.setColorAt(n, tmpColor);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  private add(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    gravity: number,
    life: number,
    size: number,
    color: string,
  ): Particle | null {
    if (this.particles.length >= MAX) return null;
    const p: Particle = {
      x,
      y,
      z,
      vx,
      vy,
      vz,
      gravity,
      age: 0,
      life,
      size,
      color: new THREE.Color(color),
      to: null,
    };
    this.particles.push(p);
    return p;
  }

  private rand(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }
}
