import * as THREE from 'three';
import VoxelScene from '../Data/Models/VoxelScene';

// Legacy parity: scene colors (sky/ground/light) were authored as raw RGB
// under three 0.99, before color management existed. Without this, modern
// three converts hex colors sRGB->linear and the ground renders far darker.
THREE.ColorManagement.enabled = false;
import { SceneTextures } from './SceneTextures';
import fullscreenVert from './shaders/fullscreen.vert?raw';
import pathTracerFrag from './shaders/pathTracer.frag?raw';
import displayFrag from './shaders/display.frag?raw';

export const MAX_TICK = 1000;

export interface VoxelRendererOptions {
  /** Stop accumulating after this many ticks (default 1000). */
  maxTick?: number;
  /**
   * Throttle the trace loop so the page doesn't monopolize the GPU.
   * Infinity (default) = one tick per animation frame; 0 = paused.
   */
  ticksPerSecond?: number;
  /** Called every 10 ticks and on completion. */
  onTick?: (tick: number, msElapsed: number) => void;
  onRendered?: () => void;
}

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
 * Owns the WebGL2 path-tracing loop: two half-float ping-pong accumulation
 * targets, a trace pass and a copy-to-canvas pass, driven by its own rAF
 * loop. React stays out of the per-tick path.
 */
export class VoxelRenderer {
  private renderer: THREE.WebGLRenderer;
  private traceMaterial: THREE.RawShaderMaterial;
  private displayMaterial: THREE.RawShaderMaterial;
  private traceScene: THREE.Scene;
  private displayScene: THREE.Scene;
  private passCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private targets: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  private previewTargets: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  private readIndex = 0;
  private tick = 0;
  private startTime = 0;
  private rafId = 0;
  private running = false;
  private sceneTextures: SceneTextures | null = null;
  private hasScene = false;
  private options: VoxelRendererOptions;
  private lastTickAt = 0;
  private lastFrameAt = 0;
  private ticksPerFrame = 1;
  private framesSinceRamp = 0;
  private lastReportedTick = -10;
  private interactiveUntil = 0;
  private wasInteractive = false;
  /** Trace ticks per second; Infinity = every frame, 0 = paused. */
  ticksPerSecond: number;
  /** Resolution scale of the low-res preview used while interacting. */
  previewScale = 0.4;

  constructor(canvas: HTMLCanvasElement, options: VoxelRendererOptions = {}) {
    this.options = options;
    this.ticksPerSecond = options.ticksPerSecond ?? Infinity;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
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
        maxTick: { value: options.maxTick ?? MAX_TICK },
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
    this.previewTargets = [makeTarget(1, 1), makeTarget(1, 1)];
  }

  get maxAtlasSize(): number {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    return gl.getParameter(gl.MAX_3D_TEXTURE_SIZE) as number;
  }

  get currentTick(): number {
    return this.tick;
  }

  get maxTick(): number {
    return this.traceMaterial.uniforms.maxTick.value as number;
  }

  set maxTick(value: number) {
    this.traceMaterial.uniforms.maxTick.value = value;
  }

  /** Next-event estimation toward emissive voxels (default on). */
  get emissiveSampling(): boolean {
    return this.traceMaterial.uniforms.neeEnabled.value === 1;
  }

  set emissiveSampling(enabled: boolean) {
    this.traceMaterial.uniforms.neeEnabled.value = enabled ? 1 : 0;
    this.resetAccumulation();
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
    this.hasScene = true;
    this.resetAccumulation();
  }

  setCamera(camera: THREE.PerspectiveCamera): void {
    camera.updateMatrixWorld();
    const u = this.traceMaterial.uniforms;
    (u.eye.value as THREE.Vector3).copy(camera.position);
    (u.viewMatrixInverse.value as THREE.Matrix4).copy(camera.matrixWorld);
    (u.projectionMatrixInverse.value as THREE.Matrix4).copy(camera.projectionMatrixInverse);
    // Drop to the low-res preview while the camera is moving, and stay
    // there briefly after the last change before ramping back up.
    this.interactiveUntil = performance.now() + 300;
    this.resetAccumulation();
  }

  setSize(width: number, height: number, pixelRatio: number): void {
    const w = Math.max(1, Math.floor(width * pixelRatio));
    const h = Math.max(1, Math.floor(height * pixelRatio));
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.targets.forEach((t) => t.setSize(w, h));
    const pw = Math.max(1, Math.floor(w * this.previewScale));
    const ph = Math.max(1, Math.floor(h * this.previewScale));
    this.previewTargets.forEach((t) => t.setSize(pw, ph));
    this.resetAccumulation();
  }

  resetAccumulation(): void {
    this.tick = 0;
    this.startTime = performance.now();
    this.ticksPerFrame = 1;
    this.framesSinceRamp = 0;
    this.lastFrameAt = 0;
    this.lastReportedTick = -10;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      const now = performance.now();

      const interactive = now < this.interactiveUntil;
      if (interactive !== this.wasInteractive) {
        // entering or leaving the low-res preview: restart accumulation
        this.wasInteractive = interactive;
        this.resetAccumulation();
      }

      if (interactive) {
        // low-res preview, single tick — keep the camera responsive
        this.renderFrame(1, this.previewTargets);
      } else if (this.ticksPerSecond === Infinity) {
        // Unregulated: sub-step. When a single trace tick is cheaper than a
        // display frame, run several ticks per frame. The rAF delta is the
        // honest GPU-saturation signal (swap-chain backpressure delays it).
        // Ramp up gently (every 4th frame) so the GPU load builds gradually
        // after interaction stops; back off immediately when over budget.
        if (this.lastFrameAt > 0) {
          const delta = now - this.lastFrameAt;
          if (delta < 17.5 && this.ticksPerFrame < 32) {
            this.framesSinceRamp++;
            if (this.framesSinceRamp >= 4) {
              this.framesSinceRamp = 0;
              this.ticksPerFrame++;
            }
          } else if (delta > 25 && this.ticksPerFrame > 1) {
            this.ticksPerFrame = Math.max(1, this.ticksPerFrame >> 1);
            this.framesSinceRamp = 0;
          }
        }
        this.lastFrameAt = now;
        this.renderFrame(this.ticksPerFrame, this.targets);
      } else if (now - this.lastTickAt >= 1000 / this.ticksPerSecond) {
        this.lastTickAt = now;
        this.lastFrameAt = 0;
        this.renderFrame(1, this.targets);
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private renderFrame(
    tickBudget: number,
    targets: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget]
  ): void {
    if (!this.hasScene) return;
    if (this.tick > this.maxTick) return;

    const u = this.traceMaterial.uniforms;
    // mutate in place — this runs every frame
    const resolution = u.resolution.value as number[];
    resolution[0] = targets[0].width;
    resolution[1] = targets[0].height;
    for (let k = 0; k < tickBudget && this.tick <= this.maxTick; k++) {
      const read = targets[this.readIndex];
      const write = targets[1 - this.readIndex];
      u.tick.value = this.tick;
      u.previousFrame.value = read.texture;
      this.renderer.setRenderTarget(write);
      this.renderer.render(this.traceScene, this.passCamera);
      this.readIndex = 1 - this.readIndex;
      this.tick++;
    }

    // after the swap, targets[readIndex] holds the latest accumulation
    this.displayMaterial.uniforms.srcTex.value = targets[this.readIndex].texture;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.displayScene, this.passCamera);

    const { onTick, onRendered } = this.options;
    if (this.tick > this.maxTick) {
      onTick?.(this.tick - 1, performance.now() - this.startTime);
      onRendered?.();
    } else if (this.tick - this.lastReportedTick >= 10) {
      // throttled: a per-frame callback means per-frame React state churn
      this.lastReportedTick = this.tick;
      onTick?.(this.tick, performance.now() - this.startTime);
    }
  }

  async captureBlob(type = 'image/jpeg', quality = 0.95): Promise<Blob | null> {
    return new Promise((resolve) => {
      this.renderer.domElement.toBlob((blob) => resolve(blob), type, quality);
    });
  }

  dispose(): void {
    this.stop();
    this.sceneTextures?.dispose();
    this.targets.forEach((t) => t.dispose());
    this.previewTargets.forEach((t) => t.dispose());
    this.traceMaterial.dispose();
    this.displayMaterial.dispose();
    this.renderer.dispose();
  }
}
