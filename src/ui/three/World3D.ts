/**
 * The 3D view: WebGL renderer, scene, sky light + sun with soft shadows, fog, resizing.
 * The sun and its shadow camera follow the camera target so shadows stay sharp at any zoom.
 */
import * as THREE from 'three';
import { CameraRig, type GroundBounds } from './CameraRig';

const SKY = '#cfe6f2';

export interface RenderStats {
  drawCalls: number;
  triangles: number;
}

export class World3D {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly rig: CameraRig;
  private readonly sun: THREE.DirectionalLight;
  private readonly sunOffset = new THREE.Vector3(-9, 22, 13);
  private readonly fog: THREE.Fog;
  private readonly onResize = (): void => this.resize();

  constructor(
    private readonly container: HTMLElement,
    bounds: GroundBounds,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.className = 'world-canvas';
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(SKY);
    this.fog = new THREE.Fog(SKY, 60, 140);
    this.scene.fog = this.fog;

    const hemi = new THREE.HemisphereLight('#e8f3ff', '#9c8a66', 1.7);
    this.scene.add(hemi);

    this.sun = new THREE.DirectionalLight('#fff1d6', 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 2;
    this.scene.add(this.sun, this.sun.target);

    this.rig = new CameraRig(bounds);
    window.addEventListener('resize', this.onResize);
    this.resize();
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  /** Settings → shadows. three.js picks the matching shaders on the next frame. */
  setShadows(on: boolean): void {
    this.sun.castShadow = on;
  }

  /** Settings → render quality: 'low' draws fewer pixels (for slow graphics cards). */
  setQuality(quality: 'high' | 'low'): void {
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(quality === 'high' ? Math.min(dpr, 2) : 0.75);
    this.resize();
  }

  render(): RenderStats {
    this.followCamera();
    this.renderer.render(this.scene, this.rig.camera);
    const info = this.renderer.info.render;
    return { drawCalls: info.calls, triangles: info.triangles };
  }

  destroy(): void {
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private followCamera(): void {
    const target = this.rig.target;
    this.sun.target.position.copy(target);
    this.sun.position.copy(target).add(this.sunOffset);
    const half = this.rig.distance * 0.75;
    const cam = this.sun.shadow.camera;
    if (cam.right !== half) {
      cam.left = -half;
      cam.right = half;
      cam.top = half;
      cam.bottom = -half;
      cam.near = 1;
      cam.far = 80;
      cam.updateProjectionMatrix();
    }
    this.fog.near = this.rig.distance * 1.5;
    this.fog.far = this.rig.distance * 3.6;
  }

  private resize(): void {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = `${w}px`;
    this.renderer.domElement.style.height = `${h}px`;
    this.rig.setAspect(w / h);
  }
}
