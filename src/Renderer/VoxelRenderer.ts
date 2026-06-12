import * as THREE from 'three';
import VoxelScene from '../Data/Models/VoxelScene';

// Legacy parity: scene colors (sky/ground/light) were authored as raw RGB
// under three 0.99, before color management existed. Without this, modern
// three converts hex colors sRGB->linear and the ground renders far darker.
THREE.ColorManagement.enabled = false;

import { BackendKind, BackendPreference, TraceBackend } from './TraceBackend';
import { WebGL2Backend } from './WebGL2Backend';

export const MAX_TICK = 1000;

export interface VoxelRendererOptions {
  /** Stop accumulating after this many ticks (default 1000). */
  maxTick?: number;
  /**
   * Throttle the trace loop so the page doesn't monopolize the GPU.
   * Infinity (default) = one tick per animation frame; 0 = paused.
   */
  ticksPerSecond?: number;
  /**
   * GPU backend: 'auto' (default) tries WebGPU and falls back to WebGL2;
   * 'webgpu' fails hard when unavailable; 'webgl2' forces the fallback.
   */
  backend?: BackendPreference;
  /** Called every 10 ticks and on completion. */
  onTick?: (tick: number, msElapsed: number) => void;
  onRendered?: () => void;
}

/**
 * Backend-neutral orchestrator: owns the rAF loop, sub-step controller,
 * tick accounting, and callbacks. GPU work is delegated to a TraceBackend
 * (WebGPU with automatic WebGL2 downgrade).
 */
export class VoxelRenderer {
  /** Resolves once a backend is initialized (after fallback, if any). */
  readonly ready: Promise<void>;

  private backend: TraceBackend | null = null;
  private backendKindValue: BackendKind | 'pending' = 'pending';
  private fallbackReasonValue: string | null = null;

  // latest desired state, applied to the backend once ready
  private scene: VoxelScene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private size: { w: number; h: number; pr: number } | null = null;
  private neeEnabled = true;
  private maxTickValue: number;

  private tick = 0;
  private startTime = 0;
  private rafId = 0;
  private running = false;
  private options: VoxelRendererOptions;
  private lastTickAt = 0;
  private lastFrameAt = 0;
  private ticksPerFrame = 1;
  private framesSinceRamp = 0;
  private lastReportedTick = -10;
  /** Trace ticks per second; Infinity = every frame, 0 = paused. */
  ticksPerSecond: number;

  constructor(canvas: HTMLCanvasElement, options: VoxelRendererOptions = {}) {
    this.options = options;
    this.ticksPerSecond = options.ticksPerSecond ?? Infinity;
    this.maxTickValue = options.maxTick ?? MAX_TICK;
    this.ready = this.initBackend(canvas, options.backend ?? 'auto');
  }

  private async initBackend(canvas: HTMLCanvasElement, preference: BackendPreference): Promise<void> {
    if (preference === 'webgpu' || preference === 'auto') {
      try {
        const { WebGPUBackend } = await import('./WebGPUBackend');
        const backend = new WebGPUBackend(canvas);
        await backend.init();
        this.backend = backend;
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e);
        if (preference === 'webgpu') {
          throw new Error(`WebGPU backend unavailable: ${reason}`);
        }
        this.fallbackReasonValue = reason;
      }
    }
    if (!this.backend) {
      const backend = new WebGL2Backend(canvas);
      await backend.init();
      this.backend = backend;
    }
    this.backendKindValue = this.backend.kind;

    // apply state that arrived while initializing
    this.backend.setMaxTick(this.maxTickValue);
    this.backend.setEmissiveSampling(this.neeEnabled);
    if (this.size) this.backend.setSize(this.size.w, this.size.h, this.size.pr);
    if (this.camera) this.backend.setCamera(this.camera);
    if (this.scene) this.backend.setScene(this.scene);
    this.resetAccumulation();
  }

  /** Active backend, or 'pending' while initializing. */
  get backendKind(): BackendKind | 'pending' {
    return this.backendKindValue;
  }

  /** Why WebGPU was downgraded to WebGL2 (null when not applicable). */
  get fallbackReason(): string | null {
    return this.fallbackReasonValue;
  }

  get currentTick(): number {
    return this.tick;
  }

  get maxTick(): number {
    return this.maxTickValue;
  }

  set maxTick(value: number) {
    this.maxTickValue = value;
    this.backend?.setMaxTick(value);
  }

  /** Next-event estimation toward emissive voxels (default on). */
  get emissiveSampling(): boolean {
    return this.neeEnabled;
  }

  set emissiveSampling(enabled: boolean) {
    this.neeEnabled = enabled;
    this.backend?.setEmissiveSampling(enabled);
    this.resetAccumulation();
  }

  setScene(scene: VoxelScene): void {
    this.scene = scene;
    this.backend?.setScene(scene);
    this.resetAccumulation();
  }

  setCamera(camera: THREE.PerspectiveCamera): void {
    this.camera = camera;
    this.backend?.setCamera(camera);
    this.resetAccumulation();
  }

  setSize(width: number, height: number, pixelRatio: number): void {
    this.size = { w: width, h: height, pr: pixelRatio };
    this.backend?.setSize(width, height, pixelRatio);
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

      if (this.ticksPerSecond === Infinity) {
        // Unregulated: sub-step. When a single trace tick is cheaper than a
        // display frame, run several ticks per frame. The rAF delta is the
        // honest GPU-saturation signal (swap-chain backpressure delays it).
        // Targets a steady 60fps: grow gently (every 4th frame) only when
        // clearly under one vsync interval, back off as soon as a frame
        // runs past it — convergence uses the headroom below the budget.
        if (this.lastFrameAt > 0) {
          const delta = now - this.lastFrameAt;
          if (delta < 16.2 && this.ticksPerFrame < 32) {
            this.framesSinceRamp++;
            if (this.framesSinceRamp >= 4) {
              this.framesSinceRamp = 0;
              this.ticksPerFrame++;
            }
          } else if (delta > 18.5 && this.ticksPerFrame > 1) {
            this.ticksPerFrame = Math.max(1, this.ticksPerFrame >> 1);
            this.framesSinceRamp = 0;
          }
        }
        this.lastFrameAt = now;
        this.renderFrame(this.ticksPerFrame);
      } else if (now - this.lastTickAt >= 1000 / this.ticksPerSecond) {
        this.lastTickAt = now;
        this.lastFrameAt = 0;
        this.renderFrame(1);
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private renderFrame(tickBudget: number): void {
    if (!this.backend || !this.scene) return;
    if (this.tick > this.maxTickValue) return;

    const count = Math.min(tickBudget, this.maxTickValue - this.tick + 1);
    this.backend.renderTicks(this.tick, count);
    this.tick += count;

    const { onTick, onRendered } = this.options;
    if (this.tick > this.maxTickValue) {
      onTick?.(this.tick - 1, performance.now() - this.startTime);
      onRendered?.();
    } else if (this.tick - this.lastReportedTick >= 10) {
      // throttled: a per-frame callback means per-frame React state churn
      this.lastReportedTick = this.tick;
      onTick?.(this.tick, performance.now() - this.startTime);
    }
  }

  async captureBlob(type = 'image/jpeg', quality = 0.95): Promise<Blob | null> {
    await this.ready;
    return this.backend!.captureBlob(type, quality);
  }

  dispose(): void {
    this.stop();
    void this.ready.then(() => this.backend?.dispose()).catch(() => {});
  }
}
