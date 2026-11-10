/**
 * VoxelBuilder: composes low-poly "voxel" models out of boxes, gable roofs and pyramid roofs,
 * then merges them into ONE BufferGeometry with one group per pixel texture (PLAN §7).
 *
 * - Colors are per-vertex (tinting the grayscale pixel texture of the face's material).
 * - UVs are world-scaled: TEXELS_PER_UNIT texels per world unit (1 unit = 1 map tile), so every
 *   model has the same pixel density, and adjacent boxes continue the pattern seamlessly.
 * - Bottom faces are skipped by default (the camera never sees them).
 *
 * Pure geometry: no DOM, unit-tested in Node.
 */
import * as THREE from 'three';
import type { TexKey } from './textures';

/** Texture repeats per world unit. With 16-px textures this means 16 texels per tile. */
export const REPEATS_PER_UNIT = 1;

type Vec3 = readonly [number, number, number];

interface Bucket {
  positions: number[];
  normals: number[];
  uvs: number[];
  colors: number[];
  indices: number[];
}

export interface BoxOptions {
  /** Pixel texture for the top face (defaults to the box's own texture). */
  top?: TexKey;
  /** Color of the top face (defaults to the box color). */
  topColor?: THREE.ColorRepresentation;
  /** Include the bottom face (default false). */
  bottom?: boolean;
}

export interface BuiltGeometry {
  geometry: THREE.BufferGeometry;
  /** Texture key for each geometry group, in material-index order. */
  textures: TexKey[];
}

const tmpColor = new THREE.Color();

export class VoxelBuilder {
  private readonly buckets = new Map<TexKey, Bucket>();
  private colorFilter: ((c: THREE.ColorRepresentation) => THREE.ColorRepresentation) | null = null;
  private scale = 1;

  /** Optional hook that maps every color (used to apply team colors). */
  setColorFilter(filter: ((c: THREE.ColorRepresentation) => THREE.ColorRepresentation) | null): this {
    this.colorFilter = filter;
    return this;
  }

  /**
   * Uniform size factor for everything drawn afterwards, around the origin. Applied before the
   * world-scaled UVs, so a bigger model keeps the same texture pixel size as everything else.
   */
  setScale(scale: number): this {
    this.scale = scale;
    return this;
  }

  private scaled(p: Vec3): Vec3 {
    const s = this.scale;
    return s === 1 ? p : [p[0] * s, p[1] * s, p[2] * s];
  }

  /** Axis-aligned box from min corner (x, y, z) with size (w, h, d). */
  box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    tex: TexKey,
    color: THREE.ColorRepresentation,
    opts: BoxOptions = {},
  ): this {
    const x1 = x + w;
    const y1 = y + h;
    const z1 = z + d;
    // Each face: 4 corners counter-clockwise as seen from outside.
    this.worldQuad(tex, color, [x1, y, z1], [x1, y, z], [x1, y1, z], [x1, y1, z1]); // +X
    this.worldQuad(tex, color, [x, y, z], [x, y, z1], [x, y1, z1], [x, y1, z]); // -X
    this.worldQuad(tex, color, [x, y, z1], [x1, y, z1], [x1, y1, z1], [x, y1, z1]); // +Z
    this.worldQuad(tex, color, [x1, y, z], [x, y, z], [x, y1, z], [x1, y1, z]); // -Z
    this.worldQuad(
      opts.top ?? tex,
      opts.topColor ?? color,
      [x, y1, z1],
      [x1, y1, z1],
      [x1, y1, z],
      [x, y1, z],
    ); // +Y
    if (opts.bottom) this.worldQuad(tex, color, [x, y, z], [x1, y, z], [x1, y, z1], [x, y, z1]); // -Y
    return this;
  }

  /** Box given by its center on the ground (cx, cz), bottom height y, and size. */
  boxC(
    cx: number,
    y: number,
    cz: number,
    w: number,
    h: number,
    d: number,
    tex: TexKey,
    color: THREE.ColorRepresentation,
    opts?: BoxOptions,
  ): this {
    return this.box(cx - w / 2, y, cz - d / 2, w, h, d, tex, color, opts);
  }

  /**
   * Gable roof over the rectangle (x, z, w, d) starting at height y, ridge height h above y.
   * `ridge` gives the axis the ridge runs along. `overhang` extends the eaves on all sides.
   */
  gableRoof(
    x: number,
    y: number,
    z: number,
    w: number,
    d: number,
    h: number,
    ridge: 'x' | 'z',
    tex: TexKey,
    color: THREE.ColorRepresentation,
    gableTex: TexKey,
    gableColor: THREE.ColorRepresentation,
    overhang = 0.1,
  ): this {
    const o = overhang;
    if (ridge === 'x') {
      const x0 = x - o;
      const x1 = x + w + o;
      const z0 = z - o;
      const z1 = z + d + o;
      const zm = z + d / 2;
      const top = y + h;
      this.localQuad(tex, color, [x1, y, z0], [x0, y, z0], [x0, top, zm], [x1, top, zm]); // slope facing -Z
      this.localQuad(tex, color, [x0, y, z1], [x1, y, z1], [x1, top, zm], [x0, top, zm]); // slope facing +Z
      this.tri(
        gableTex,
        gableColor,
        [x + 0.001, y, z0 + o],
        [x + 0.001, y, z1 - o],
        [x + 0.001, top - o * 0.8, zm],
      ); // -X end
      this.tri(
        gableTex,
        gableColor,
        [x + w - 0.001, y, z1 - o],
        [x + w - 0.001, y, z0 + o],
        [x + w - 0.001, top - o * 0.8, zm],
      ); // +X end
    } else {
      const x0 = x - o;
      const x1 = x + w + o;
      const z0 = z - o;
      const z1 = z + d + o;
      const xm = x + w / 2;
      const top = y + h;
      this.localQuad(tex, color, [x0, y, z0], [x0, y, z1], [xm, top, z1], [xm, top, z0]); // slope facing -X
      this.localQuad(tex, color, [x1, y, z1], [x1, y, z0], [xm, top, z0], [xm, top, z1]); // slope facing +X
      this.tri(
        gableTex,
        gableColor,
        [x1 - o, y, z + 0.001],
        [x0 + o, y, z + 0.001],
        [xm, top - o * 0.8, z + 0.001],
      ); // -Z end
      this.tri(
        gableTex,
        gableColor,
        [x0 + o, y, z + d - 0.001],
        [x1 - o, y, z + d - 0.001],
        [xm, top - o * 0.8, z + d - 0.001],
      ); // +Z end
    }
    return this;
  }

  /** Four-sided pyramid roof over (x, z, w, d) from height y, apex h above y. */
  pyramidRoof(
    x: number,
    y: number,
    z: number,
    w: number,
    d: number,
    h: number,
    tex: TexKey,
    color: THREE.ColorRepresentation,
    overhang = 0.1,
  ): this {
    const x0 = x - overhang;
    const x1 = x + w + overhang;
    const z0 = z - overhang;
    const z1 = z + d + overhang;
    const apex: Vec3 = [x + w / 2, y + h, z + d / 2];
    this.tri(tex, color, [x1, y, z0], [x0, y, z0], apex); // -Z
    this.tri(tex, color, [x0, y, z1], [x1, y, z1], apex); // +Z
    this.tri(tex, color, [x0, y, z0], [x0, y, z1], apex); // -X
    this.tri(tex, color, [x1, y, z1], [x1, y, z0], apex); // +X
    return this;
  }

  /** Merge everything into one geometry (one group per texture). */
  build(): BuiltGeometry {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const textures: TexKey[] = [];
    const geometry = new THREE.BufferGeometry();

    for (const [tex, b] of this.buckets) {
      const base = positions.length / 3;
      const start = indices.length;
      positions.push(...b.positions);
      normals.push(...b.normals);
      uvs.push(...b.uvs);
      colors.push(...b.colors);
      for (const i of b.indices) indices.push(i + base);
      geometry.addGroup(start, b.indices.length, textures.length);
      textures.push(tex);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return { geometry, textures };
  }

  // ---- internals ------------------------------------------------------------------------------

  private bucket(tex: TexKey): Bucket {
    let b = this.buckets.get(tex);
    if (!b) {
      b = { positions: [], normals: [], uvs: [], colors: [], indices: [] };
      this.buckets.set(tex, b);
    }
    return b;
  }

  /**
   * Single quad (corners counter-clockwise as seen from the front), UVs from world coordinates
   * so the pattern continues seamlessly across neighbouring faces.
   */
  quad(tex: TexKey, color: THREE.ColorRepresentation, a: Vec3, b: Vec3, c: Vec3, d: Vec3): this {
    this.worldQuad(tex, color, a, b, c, d);
    return this;
  }

  /** Quad whose UVs come from world coordinates projected on the dominant axis (seamless boxes). */
  private worldQuad(tex: TexKey, color: THREE.ColorRepresentation, a: Vec3, b: Vec3, c: Vec3, d: Vec3): void {
    [a, b, c, d] = [this.scaled(a), this.scaled(b), this.scaled(c), this.scaled(d)];
    const n = faceNormal(a, b, d);
    const uv = (p: Vec3): [number, number] => worldUv(p, n);
    this.pushPolygon(tex, color, [a, b, c, d], n, [uv(a), uv(b), uv(c), uv(d)]);
  }

  /** Quad whose UVs follow its own edges (roof slopes: rows of shingles parallel to the eave). */
  private localQuad(tex: TexKey, color: THREE.ColorRepresentation, a: Vec3, b: Vec3, c: Vec3, d: Vec3): void {
    [a, b, c, d] = [this.scaled(a), this.scaled(b), this.scaled(c), this.scaled(d)];
    const n = faceNormal(a, b, d);
    const uv = localUvFrame(a, b, n);
    this.pushPolygon(tex, color, [a, b, c, d], n, [uv(a), uv(b), uv(c), uv(d)]);
  }

  private tri(tex: TexKey, color: THREE.ColorRepresentation, a: Vec3, b: Vec3, c: Vec3): void {
    [a, b, c] = [this.scaled(a), this.scaled(b), this.scaled(c)];
    const n = faceNormal(a, b, c);
    const uv = localUvFrame(a, b, n);
    this.pushPolygon(tex, color, [a, b, c], n, [uv(a), uv(b), uv(c)]);
  }

  private pushPolygon(
    tex: TexKey,
    color: THREE.ColorRepresentation,
    points: Vec3[],
    n: Vec3,
    uvs: Array<[number, number]>,
  ): void {
    const b = this.bucket(tex);
    const base = b.positions.length / 3;
    tmpColor.set(this.colorFilter ? this.colorFilter(color) : color);
    points.forEach((p, i) => {
      b.positions.push(p[0], p[1], p[2]);
      b.normals.push(n[0], n[1], n[2]);
      const uv = uvs[i] ?? [0, 0];
      b.uvs.push(uv[0], uv[1]);
      b.colors.push(tmpColor.r, tmpColor.g, tmpColor.b);
    });
    for (let i = 1; i < points.length - 1; i++) b.indices.push(base, base + i, base + i + 1);
  }
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function normalize(a: Vec3): Vec3 {
  const len = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / len, a[1] / len, a[2] / len];
}

/** Outward normal of a CCW polygon a→b→…→c. */
function faceNormal(a: Vec3, b: Vec3, c: Vec3): Vec3 {
  return normalize(cross(sub(b, a), sub(c, a)));
}

function worldUv(p: Vec3, n: Vec3): [number, number] {
  const ax = Math.abs(n[0]);
  const ay = Math.abs(n[1]);
  const az = Math.abs(n[2]);
  const s = REPEATS_PER_UNIT;
  if (ax >= ay && ax >= az) return [p[2] * s, p[1] * s];
  if (az >= ay) return [p[0] * s, p[1] * s];
  return [p[0] * s, p[2] * s];
}

function localUvFrame(origin: Vec3, along: Vec3, n: Vec3): (p: Vec3) => [number, number] {
  const e1 = normalize(sub(along, origin));
  const e2 = normalize(cross(n, e1));
  const s = REPEATS_PER_UNIT;
  return (p) => {
    const rel = sub(p, origin);
    return [dot(rel, e1) * s, dot(rel, e2) * s];
  };
}
