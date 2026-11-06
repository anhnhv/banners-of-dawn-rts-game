import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { VoxelBuilder } from '../../src/ui/art/VoxelBuilder';

function triangles(
  geometry: THREE.BufferGeometry,
): Array<{ a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3; n: THREE.Vector3 }> {
  const pos = geometry.getAttribute('position');
  const nor = geometry.getAttribute('normal');
  const index = geometry.getIndex();
  if (!index) throw new Error('expected indexed geometry');
  const out = [];
  for (let i = 0; i < index.count; i += 3) {
    const [ia, ib, ic] = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    out.push({
      a: new THREE.Vector3().fromBufferAttribute(pos, ia),
      b: new THREE.Vector3().fromBufferAttribute(pos, ib),
      c: new THREE.Vector3().fromBufferAttribute(pos, ic),
      n: new THREE.Vector3().fromBufferAttribute(nor, ia),
    });
  }
  return out;
}

describe('VoxelBuilder', () => {
  it('builds a box with 5 faces (no bottom), all facing outward and counter-clockwise', () => {
    const { geometry, textures } = new VoxelBuilder().box(1, 0, 2, 2, 1, 3, 'planks', '#ffffff').build();
    expect(textures).toEqual(['planks']);
    expect(geometry.getAttribute('position').count).toBe(20);
    const center = new THREE.Vector3(2, 0.5, 3.5);
    for (const t of triangles(geometry)) {
      const faceCenter = t.a.clone().add(t.b).add(t.c).divideScalar(3);
      expect(faceCenter.sub(center).dot(t.n)).toBeGreaterThan(0); // outward
      const wound = t.b.clone().sub(t.a).cross(t.c.clone().sub(t.a)).normalize();
      expect(wound.dot(t.n)).toBeCloseTo(1, 5); // CCW = front face
      expect(t.n.length()).toBeCloseTo(1, 6);
    }
  });

  it('can include the bottom face', () => {
    const { geometry } = new VoxelBuilder().box(0, 0, 0, 1, 1, 1, 'plain', '#fff', { bottom: true }).build();
    expect(geometry.getAttribute('position').count).toBe(24);
  });

  it('puts different textures in separate groups', () => {
    const { geometry, textures } = new VoxelBuilder()
      .box(0, 0, 0, 1, 1, 1, 'bricks', '#fff', { top: 'rock' })
      .box(2, 0, 0, 1, 1, 1, 'bricks', '#fff')
      .build();
    expect(textures).toEqual(['bricks', 'rock']);
    expect(geometry.groups).toHaveLength(2);
    expect(geometry.groups[0]?.materialIndex).toBe(0);
    expect(geometry.groups[1]?.materialIndex).toBe(1);
  });

  it('builds roofs whose slopes face up and outward, consistently wound', () => {
    for (const ridge of ['x', 'z'] as const) {
      const { geometry } = new VoxelBuilder()
        .gableRoof(0, 1, 0, 2, 2, 1, ridge, 'shingles', '#fff', 'plain', '#fff')
        .pyramidRoof(4, 1, 0, 2, 2, 1, 'shingles', '#fff')
        .build();
      for (const t of triangles(geometry)) {
        const wound = t.b.clone().sub(t.a).cross(t.c.clone().sub(t.a)).normalize();
        expect(wound.dot(t.n)).toBeCloseTo(1, 5);
        expect(t.n.y).toBeGreaterThanOrEqual(-1e-9); // nothing faces down
      }
    }
  });

  it('applies the color filter (team colors)', () => {
    const { geometry } = new VoxelBuilder()
      .setColorFilter((c) => (c === 'team' ? '#ff0000' : c))
      .box(0, 0, 0, 1, 1, 1, 'plain', 'team')
      .build();
    const colors = geometry.getAttribute('color');
    expect(colors.getX(0)).toBeCloseTo(1);
    expect(colors.getY(0)).toBeCloseTo(0);
    expect(colors.getZ(0)).toBeCloseTo(0);
  });

  it('uses world-scaled UVs so neighbouring boxes continue the pixel pattern', () => {
    const { geometry } = new VoxelBuilder().box(3, 0, 0, 1, 1, 1, 'planks', '#fff').build();
    const uv = geometry.getAttribute('uv');
    // The +X face is first; its first corner sits at z = 1 → u = 1.
    expect(uv.getX(0)).toBeCloseTo(1);
  });
});
