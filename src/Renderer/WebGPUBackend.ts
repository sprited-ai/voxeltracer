import type { PerspectiveCamera } from 'three';
import VoxelScene from '../Data/Models/VoxelScene';
import { TraceBackend } from './TraceBackend';

/**
 * WebGPU backend: compute-shader path tracer (kernel lands in a later
 * task — this skeleton establishes device init, canvas configuration, and
 * the present pass wiring). Compute-first keeps the kernel portable to
 * Node (Dawn) and other non-browser hosts.
 */
export class WebGPUBackend implements TraceBackend {
  readonly kind = 'webgpu' as const;

  private canvas: HTMLCanvasElement;
  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private format!: GPUTextureFormat;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  async init(): Promise<void> {
    const gpu = navigator.gpu;
    if (!gpu) {
      throw new Error('navigator.gpu is not available');
    }
    // Request adapter/device BEFORE touching the canvas: a successful
    // getContext locks the canvas to one context type, which would break
    // the WebGL2 fallback.
    const adapter = await gpu.requestAdapter();
    if (!adapter) {
      throw new Error('no WebGPU adapter');
    }
    this.device = await adapter.requestDevice();
    const context = this.canvas.getContext('webgpu');
    if (!context) {
      throw new Error('webgpu canvas context unavailable');
    }
    this.context = context;
    this.format = gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'opaque',
    });
  }

  setScene(_scene: VoxelScene): void {
    // resources upload lands with the kernel task
  }

  setCamera(_camera: PerspectiveCamera): void {
    // uniforms land with the kernel task
  }

  setSize(cssWidth: number, cssHeight: number, pixelRatio: number): void {
    this.canvas.width = Math.max(1, Math.floor(cssWidth * pixelRatio));
    this.canvas.height = Math.max(1, Math.floor(cssHeight * pixelRatio));
  }

  setEmissiveSampling(_enabled: boolean): void {}

  setMaxTick(_maxTick: number): void {}

  renderTicks(_startTick: number, _count: number): void {
    // Skeleton: present a recognizable clear color so the backend wiring is
    // visible end-to-end before the kernel exists.
    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.context.getCurrentTexture().createView(),
          clearValue: { r: 0.05, g: 0.25, b: 0.3, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }

  async captureBlob(type = 'image/jpeg', quality = 0.95): Promise<Blob | null> {
    return new Promise((resolve) => {
      this.canvas.toBlob((blob) => resolve(blob), type, quality);
    });
  }

  dispose(): void {
    this.device?.destroy();
  }
}
