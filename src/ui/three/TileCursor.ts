/** Highlight for the tile under the mouse: a thin outline plus a faint fill, drawn on the ground. */
import * as THREE from 'three';

export class TileCursor {
  readonly object = new THREE.Group();
  private tile: { x: number; y: number } | null = null;

  constructor(color = '#ffffff') {
    const line = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false });
    const fill = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, depthWrite: false });
    const t = 0.06;
    const bar = (x: number, z: number, w: number, d: number): void => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), line);
      m.position.set(x + w / 2, 0, z + d / 2);
      this.object.add(m);
    };
    bar(0, 0, 1, t);
    bar(0, 1 - t, 1, t);
    bar(0, 0, t, 1);
    bar(1 - t, 0, t, 1);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), fill);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(0.5, 0, 0.5);
    this.object.add(plane);
    this.object.position.y = 0.03;
    this.object.renderOrder = 3;
    this.object.visible = false;
  }

  get current(): { x: number; y: number } | null {
    return this.tile;
  }

  set(tile: { x: number; y: number } | null): void {
    this.tile = tile;
    this.object.visible = tile !== null;
    if (tile) this.object.position.set(tile.x, 0.03, tile.y);
  }
}
