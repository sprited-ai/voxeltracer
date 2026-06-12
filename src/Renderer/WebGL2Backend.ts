import * as THREE from 'three';
import VoxelScene from '../Data/Models/VoxelScene';
import { SceneTextures } from './SceneTextures';
import { TraceBackend } from './TraceBackend';
import fullscreenVert from './shaders/fullscreen.vert?raw';
import pathTracerFrag from './shaders/pathTracer.frag?raw';
import displayFrag from './shaders/display.frag?raw';

function makeTarget(width: number, height: number): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(width, height, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: false,
    stencilBuffer: false,
  });
}

function fullscreenScene(material: THREE.RawShaderMaterial): THREE.Scene {
  const scene = new THREE.Scene();
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  scene.add(mesh);
  return scene;
}

/**
 * WebGL2 backend (three.js): GLSL ES 3.00 fragment path tracer with two
 * half-float ping-pong accumulation targets and a copy-to-canvas pass.
 */
export class WebGL2Backend implements TraceBackend {
  readonly kind = 'webgl2' as const;

  private canvas: HTMLCanvasElement;
  private renderer!: THREE.WebGLRenderer;
  private traceMaterial!: THREE.RawShaderMaterial;
  private displayMaterial!: THREE.RawShaderMaterial;
  private traceScene!: THREE.Scene;
  private displayScene!: THREE.Scene;
  private passCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private targets!: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  private readIndex = 0;
  private sceneTextures: SceneTextures | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  async init(): Promise<void> {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      // needed for canvas.toBlob() captures
      preserveDrawingBuffer: true,
      antialias: false,
    });
    // No tone mapping / color-space handling: RawShaderMaterial writes raw
    // values, matching the legacy gl-react pipeline.
    this.renderer.toneMapping = THREE.NoToneMapping;

    this.traceMaterial = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: fullscreenVert,
      fragmentShader: pathTracerFrag,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        eye: { value: new THREE.Vector3() },
        lightDir: { value: new THREE.Vector3(-1.1, 1.9, 1.7).normalize() },
        lightColor: { value: new THREE.Color() },
        skyColor: { value: new THREE.Color() },
        groundColor: { value: new THREE.Color() },
        viewMatrixInverse: { value: new THREE.Matrix4() },
        projectionMatrixInverse: { value: new THREE.Matrix4() },
        tick: { value: 0 },
        maxTick: { value: 1000 },
        resolution: { value: [1, 1] },
        voxelAtlas: { value: null },
        shapeTex: { value: null },
        bvhTex: { value: null },
        lightTex: { value: null },
        shapeCount: { value: 0 },
        lightCount: { value: 0 },
        neeEnabled: { value: 1 },
        colorTexture: { value: null },
        materialTexture: { value: null },
        previousFrame: { value: null },
      },
    });

    this.displayMaterial = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: fullscreenVert,
      fragmentShader: displayFrag,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        srcTex: { value: null },
      },
    });

    this.traceScene = fullscreenScene(this.traceMaterial);
    this.displayScene = fullscreenScene(this.displayMaterial);
    this.targets = [makeTarget(1, 1), makeTarget(1, 1)];
  }

  private get maxAtlasSize(): number {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    return gl.getParameter(gl.MAX_3D_TEXTURE_SIZE) as number;
  }

  setScene(scene: VoxelScene): void {
    this.sceneTextures?.dispose();
    const textures = SceneTextures.fromScene(scene, this.maxAtlasSize);
    this.sceneTextures = textures;
    const u = this.traceMaterial.uniforms;
    u.voxelAtlas.value = textures.atlas;
    u.shapeTex.value = textures.shapeTex;
    u.bvhTex.value = textures.bvhTex;
    u.lightTex.value = textures.lightTex;
    u.shapeCount.value = textures.shapeCount;
    u.lightCount.value = textures.lightCount;
    u.colorTexture.value = textures.colorTex;
    u.materialTexture.value = textures.materialTex;
    (u.lightColor.value as THREE.Color).copy(scene.lightColor);
    (u.skyColor.value as THREE.Color).copy(scene.skyColor);
    (u.groundColor.value as THREE.Color).copy(scene.groundColor);
  }

  setCamera(camera: THREE.PerspectiveCamera): void {
    camera.updateMatrixWorld();
    const u = this.traceMaterial.uniforms;
    (u.eye.value as THREE.Vector3).copy(camera.position);
    (u.viewMatrixInverse.value as THREE.Matrix4).copy(camera.matrixWorld);
    (u.projectionMatrixInverse.value as THREE.Matrix4).copy(camera.projectionMatrixInverse);
  }

  setSize(cssWidth: number, cssHeight: number, pixelRatio: number): void {
    const w = Math.max(1, Math.floor(cssWidth * pixelRatio));
    const h = Math.max(1, Math.floor(cssHeight * pixelRatio));
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(cssWidth, cssHeight, false);
    this.targets.forEach((t) => t.setSize(w, h));
  }

  setEmissiveSampling(enabled: boolean): void {
    this.traceMaterial.uniforms.neeEnabled.value = enabled ? 1 : 0;
  }

  setMaxTick(maxTick: number): void {
    this.traceMaterial.uniforms.maxTick.value = maxTick;
  }

  renderTicks(startTick: number, count: number): void {
    const targets = this.targets;
    const u = this.traceMaterial.uniforms;
    // mutate in place — this runs every frame
    const resolution = u.resolution.value as number[];
    resolution[0] = targets[0].width;
    resolution[1] = targets[0].height;

    for (let k = 0; k < count; k++) {
      const read = targets[this.readIndex];
      const write = targets[1 - this.readIndex];
      u.tick.value = startTick + k;
      u.previousFrame.value = read.texture;
      this.renderer.setRenderTarget(write);
      this.renderer.render(this.traceScene, this.passCamera);
      this.readIndex = 1 - this.readIndex;
    }

    // after the swap, targets[readIndex] holds the latest accumulation
    this.displayMaterial.uniforms.srcTex.value = targets[this.readIndex].texture;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.displayScene, this.passCamera);
  }

  async captureBlob(type = 'image/jpeg', quality = 0.95): Promise<Blob | null> {
    return new Promise((resolve) => {
      this.canvas.toBlob((blob) => resolve(blob), type, quality);
    });
  }

  dispose(): void {
    this.sceneTextures?.dispose();
    this.targets?.forEach((t) => t.dispose());
    this.traceMaterial?.dispose();
    this.displayMaterial?.dispose();
    this.renderer?.dispose();
  }
}
