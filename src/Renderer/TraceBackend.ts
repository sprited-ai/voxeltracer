import type { PerspectiveCamera } from 'three';
import type VoxelScene from '../Data/Models/VoxelScene';

export type BackendKind = 'webgl2' | 'webgpu';
export type BackendPreference = BackendKind | 'auto';

/**
 * A GPU backend for the path tracer. The orchestrator (VoxelRenderer) owns
 * the loop, tick accounting, throttling, and callbacks; a backend owns the
 * device, scene resources, and the trace + present passes.
 */
export interface TraceBackend {
  readonly kind: BackendKind;
  /**
   * Acquire the GPU device/context. Must not touch the canvas before it can
   * commit to it — a throw here triggers fallback to the next backend, and
   * a canvas can only ever hold one context type.
   */
  init(): Promise<void>;
  setScene(scene: VoxelScene): void;
  setCamera(camera: PerspectiveCamera): void;
  setSize(cssWidth: number, cssHeight: number, pixelRatio: number): void;
  setEmissiveSampling(enabled: boolean): void;
  setMaxTick(maxTick: number): void;
  /** Trace `count` ticks starting at `startTick`, then present to the canvas. */
  renderTicks(startTick: number, count: number): void;
  captureBlob(type?: string, quality?: number): Promise<Blob | null>;
  dispose(): void;
}
