import { describe, expect, it } from 'vitest';
import { CameraRig } from '../../src/ui/three/CameraRig';

const bounds = { minX: 0, maxX: 40, minZ: 0, maxZ: 40 };

describe('CameraRig', () => {
  it('looks at its target: the screen center hits the target on the ground', () => {
    const rig = new CameraRig(bounds);
    rig.target.set(12, 0, 30);
    rig.update();
    const hit = rig.groundAt(0, 0);
    expect(hit).not.toBeNull();
    expect(hit?.x).toBeCloseTo(12, 4);
    expect(hit?.z).toBeCloseTo(30, 4);
  });

  it('pans in screen space: right is +x/−z and up is away from the camera', () => {
    const rig = new CameraRig(bounds);
    rig.target.set(20, 0, 20);
    rig.pan(1, 0);
    expect(rig.target.x).toBeGreaterThan(20);
    expect(rig.target.z).toBeLessThan(20);
    rig.target.set(20, 0, 20);
    rig.update();
    const before = rig.camera.position.distanceTo(rig.target);
    rig.pan(0, 1);
    // moving "up" moves the target away from where the camera stood
    expect(rig.target.x).toBeLessThan(20);
    expect(rig.target.z).toBeLessThan(20);
    expect(rig.camera.position.distanceTo(rig.target)).toBeCloseTo(before, 6);
  });

  it('a point to the right of center on screen is to the camera-right on the ground', () => {
    const rig = new CameraRig(bounds);
    rig.target.set(20, 0, 20);
    rig.update();
    const center = rig.groundAt(0, 0);
    const right = rig.groundAt(0.5, 0);
    expect(center && right).toBeTruthy();
    if (center && right) expect(right.clone().sub(center).dot(rig.right)).toBeGreaterThan(0);
  });

  it('clamps the target to the map and the zoom to its limits', () => {
    const rig = new CameraRig(bounds);
    rig.pan(-1000, 0);
    expect(rig.target.x).toBeGreaterThanOrEqual(0);
    expect(rig.target.z).toBeLessThanOrEqual(40);
    rig.zoom(0.0001);
    expect(rig.distance).toBe(rig.minDistance);
    rig.zoom(1e6);
    expect(rig.distance).toBe(rig.maxDistance);
  });
});
