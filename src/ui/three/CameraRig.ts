/**
 * RTS camera: a perspective camera at a fixed yaw (45°) and pitch, looking at a target on the
 * ground. Low field of view keeps the "isometric diorama" feel while staying truly 3D (PLAN §7).
 * Pure math + three.js objects, no DOM (unit-tested).
 */
import * as THREE from 'three';

export interface GroundBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly target = new THREE.Vector3();
  readonly yaw = Math.PI / 4;
  readonly pitch = THREE.MathUtils.degToRad(52);
  distance = 30;
  minDistance = 10;
  maxDistance = 64;

  private readonly raycaster = new THREE.Raycaster();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  constructor(
    private readonly bounds: GroundBounds,
    fov = 30,
  ) {
    this.camera = new THREE.PerspectiveCamera(fov, 16 / 9, 0.5, 400);
    this.target.set((bounds.minX + bounds.maxX) / 2, 0, (bounds.minZ + bounds.maxZ) / 2);
    this.update();
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** Screen-space right, projected on the ground. */
  get right(): THREE.Vector3 {
    return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
  }

  /** Screen-space up, projected on the ground (pointing away from the camera). */
  get forward(): THREE.Vector3 {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  /** Move the target by (dx right, dy up) in world units. */
  pan(dx: number, dy: number): void {
    this.target.addScaledVector(this.right, dx).addScaledVector(this.forward, dy);
    this.clamp();
    this.update();
  }

  /** Multiply the distance (factor < 1 zooms in). */
  zoom(factor: number): void {
    this.distance = THREE.MathUtils.clamp(this.distance * factor, this.minDistance, this.maxDistance);
    this.update();
  }

  /** World units per screen pixel at the target, for drag-panning. */
  worldPerPixel(viewportHeightPx: number): number {
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    return (2 * this.distance * Math.tan(fov / 2)) / Math.max(1, viewportHeightPx);
  }

  update(): void {
    const horizontal = Math.cos(this.pitch) * this.distance;
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * horizontal,
      this.target.y + Math.sin(this.pitch) * this.distance,
      this.target.z + Math.cos(this.yaw) * horizontal,
    );
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
  }

  /** Ground point under normalized device coordinates (-1..1), or null if the ray misses. */
  groundAt(ndcX: number, ndcY: number): THREE.Vector3 | null {
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const hit = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.groundPlane, hit);
  }

  private clamp(): void {
    this.target.x = THREE.MathUtils.clamp(this.target.x, this.bounds.minX, this.bounds.maxX);
    this.target.z = THREE.MathUtils.clamp(this.target.z, this.bounds.minZ, this.bounds.maxZ);
  }
}
