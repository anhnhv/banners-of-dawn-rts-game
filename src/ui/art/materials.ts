import * as THREE from 'three';
import { pixelTexture, type TexKey } from './textures';

const cache = new Map<TexKey, THREE.MeshLambertMaterial>();

/**
 * One shared material per pixel texture. Vertex colors tint the grayscale texture,
 * so all models share a handful of materials (few shader programs, cheap batching).
 */
export function voxelMaterial(key: TexKey): THREE.MeshLambertMaterial {
  let mat = cache.get(key);
  if (!mat) {
    mat = new THREE.MeshLambertMaterial({ map: pixelTexture(key), vertexColors: true });
    mat.name = `voxel:${key}`;
    cache.set(key, mat);
  }
  return mat;
}
