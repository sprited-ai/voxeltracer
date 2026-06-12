import type { PerspectiveCamera } from 'three';
import VoxelScene from '../Data/Models/VoxelScene';
import { buildSceneData } from './SceneTextures';
import { TraceBackend } from './TraceBackend';
import pathTracerWgsl from './shaders/pathTracer.wgsl?raw';
import presentWgsl from './shaders/present.wgsl?raw';

// Uniforms struct: 2 mat4 + 5 vec4 + 8 i32 = 240 bytes
const UNIFORM_SIZE = 240;

/**
 * WebGPU backend: the path tracer runs as a compute shader (one invocation
 * per pixel) ping-ponging between two rgba16float storage textures; a
 * trivial render pass presents the latest accumulation. Compute-first keeps
 * the kernel portable to Node (Dawn) and other non-browser hosts.
 */
export class WebGPUBackend implements TraceBackend {
  readonly kind = 'webgpu' as const;

  private canvas: HTMLCanvasElement;
  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private format!: GPUTextureFormat;

  private tracePipeline!: GPUComputePipeline;
  private presentPipeline!: GPURenderPipeline;
  private uniformBuffer!: GPUBuffer;
  private uniformF32 = new Float32Array(UNIFORM_SIZE / 4);
  private uniformI32 = new Int32Array(this.uniformF32.buffer);

  // scene resources
  private atlasTexture: GPUTexture | null = null;
  private shapeBuffer: GPUBuffer | null = null;
  private bvhBuffer: GPUBuffer | null = null;
  private lightBuffer: GPUBuffer | null = null;
  private paletteBuffer: GPUBuffer | null = null;
  private materialBuffer: GPUBuffer | null = null;

  // accumulation ping-pong
  private accumTextures: [GPUTexture, GPUTexture] | null = null;
  private traceBindGroups: [GPUBindGroup, GPUBindGroup] | null = null;
  private presentBindGroups: [GPUBindGroup, GPUBindGroup] | null = null;
  private readIndex = 0;
  private width = 1;
  private height = 1;

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
    this.format = gpu.getPreferredCanvasFormat();

    const traceModule = this.device.createShaderModule({ code: pathTracerWgsl });
    const presentModule = this.device.createShaderModule({ code: presentWgsl });
    for (const [name, module] of [
      ['pathTracer.wgsl', traceModule],
      ['present.wgsl', presentModule],
    ] as const) {
      const info = await module.getCompilationInfo();
      const errors = info.messages.filter((m) => m.type === 'error');
      if (errors.length > 0) {
        const text = errors
          .map((m) => `${name}:${m.lineNum}:${m.linePos} ${m.message}`)
          .join('\n');
        throw new Error(`WGSL compile failed:\n${text}`);
      }
    }

    this.tracePipeline = this.device.createComputePipeline({
      layout: 'auto',
      compute: { module: traceModule, entryPoint: 'main' },
    });
    this.presentPipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: presentModule, entryPoint: 'vs' },
      fragment: {
        module: presentModule,
        entryPoint: 'fs',
        targets: [{ format: this.format }],
      },
      primitive: { topology: 'triangle-list' },
    });

    this.uniformBuffer = this.device.createBuffer({
      size: UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Touch the canvas only after every fallible step has passed — a
    // successful getContext locks the canvas to one context type, which
    // would break the WebGL2 fallback.
    const context = this.canvas.getContext('webgpu');
    if (!context) {
      throw new Error('webgpu canvas context unavailable');
    }
    this.context = context;
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'opaque',
    });

    // sane defaults (matches WebGL2 backend)
    this.setVec4(36, [-1.1, 1.9, 1.7], 0, true); // lightDir
    this.uniformI32[58] = 1; // neeEnabled
  }

  private get maxAtlasSize(): number {
    return this.device.limits.maxTextureDimension3D;
  }

  private storageBuffer(data: Float32Array): GPUBuffer {
    const size = Math.max(16, data.byteLength);
    const buffer = this.device.createBuffer({
      size,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    if (data.byteLength > 0) {
      this.device.queue.writeBuffer(buffer, 0, data.buffer, data.byteOffset, data.byteLength);
    }
    return buffer;
  }

  private setVec4(
    floatOffset: number,
    xyz: [number, number, number] | number[],
    w = 0,
    normalize = false
  ): void {
    let [x, y, z] = xyz;
    if (normalize) {
      const len = Math.hypot(x, y, z) || 1;
      x /= len;
      y /= len;
      z /= len;
    }
    this.uniformF32[floatOffset] = x;
    this.uniformF32[floatOffset + 1] = y;
    this.uniformF32[floatOffset + 2] = z;
    this.uniformF32[floatOffset + 3] = w;
  }

  setScene(scene: VoxelScene): void {
    const data = buildSceneData(scene, this.maxAtlasSize);

    this.disposeSceneResources();

    const [w, h, d] = data.atlasSize;
    this.atlasTexture = this.device.createTexture({
      size: { width: w, height: h, depthOrArrayLayers: d },
      dimension: '3d',
      format: 'r8uint',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    this.device.queue.writeTexture(
      { texture: this.atlasTexture },
      data.atlas as Uint8Array<ArrayBuffer>,
      { bytesPerRow: w, rowsPerImage: h },
      { width: w, height: h, depthOrArrayLayers: d }
    );

    this.shapeBuffer = this.storageBuffer(data.shapes);
    this.bvhBuffer = this.storageBuffer(data.bvh);
    this.lightBuffer = this.storageBuffer(data.lights);

    // palette: normalized rgba; materials: raw byte values (exact integer
    // round-trip for the type byte)
    const palette = new Float32Array(1024);
    const materials = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      palette[i] = data.palette[i] / 255;
      materials[i] = data.materials[i];
    }
    this.paletteBuffer = this.storageBuffer(palette);
    this.materialBuffer = this.storageBuffer(materials);

    // scene uniforms
    this.setVec4(40, [scene.lightColor.r, scene.lightColor.g, scene.lightColor.b], 1);
    this.setVec4(44, [scene.skyColor.r, scene.skyColor.g, scene.skyColor.b], 1);
    this.setVec4(48, [scene.groundColor.r, scene.groundColor.g, scene.groundColor.b], 1);
    this.uniformI32[56] = data.shapeCount;
    this.uniformI32[57] = data.lightCount;

    this.traceBindGroups = null;
  }

  setCamera(camera: PerspectiveCamera): void {
    camera.updateMatrixWorld();
    this.uniformF32.set(camera.matrixWorld.elements, 0);
    this.uniformF32.set(camera.projectionMatrixInverse.elements, 16);
    this.setVec4(32, [camera.position.x, camera.position.y, camera.position.z], 1);
  }

  setSize(cssWidth: number, cssHeight: number, pixelRatio: number): void {
    this.width = Math.max(1, Math.floor(cssWidth * pixelRatio));
    this.height = Math.max(1, Math.floor(cssHeight * pixelRatio));
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    this.accumTextures?.forEach((t) => t.destroy());
    const makeAccum = () =>
      this.device.createTexture({
        size: { width: this.width, height: this.height },
        format: 'rgba16float',
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
      });
    this.accumTextures = [makeAccum(), makeAccum()];
    this.traceBindGroups = null;
  }

  setEmissiveSampling(enabled: boolean): void {
    this.uniformI32[58] = enabled ? 1 : 0;
  }

  setMaxTick(maxTick: number): void {
    this.uniformI32[55] = maxTick;
  }

  private ensureBindGroups(): boolean {
    if (this.traceBindGroups && this.presentBindGroups) return true;
    if (!this.accumTextures || !this.atlasTexture) return false;

    const views = [this.accumTextures[0].createView(), this.accumTextures[1].createView()];
    const layout = this.tracePipeline.getBindGroupLayout(0);
    const mk = (read: number) =>
      this.device.createBindGroup({
        layout,
        entries: [
          { binding: 0, resource: { buffer: this.uniformBuffer } },
          { binding: 1, resource: this.atlasTexture!.createView() },
          { binding: 2, resource: { buffer: this.shapeBuffer! } },
          { binding: 3, resource: { buffer: this.bvhBuffer! } },
          { binding: 4, resource: { buffer: this.lightBuffer! } },
          { binding: 5, resource: { buffer: this.paletteBuffer! } },
          { binding: 6, resource: { buffer: this.materialBuffer! } },
          { binding: 7, resource: views[read] },
          { binding: 8, resource: views[1 - read] },
        ],
      });
    this.traceBindGroups = [mk(0), mk(1)];

    const presentLayout = this.presentPipeline.getBindGroupLayout(0);
    const mkPresent = (index: number) =>
      this.device.createBindGroup({
        layout: presentLayout,
        entries: [{ binding: 0, resource: views[index] }],
      });
    this.presentBindGroups = [mkPresent(0), mkPresent(1)];
    return true;
  }

  renderTicks(startTick: number, count: number): void {
    if (!this.ensureBindGroups()) return;

    // resolution
    this.uniformI32[52] = this.width;
    this.uniformI32[53] = this.height;

    const wgX = Math.ceil(this.width / 8);
    const wgY = Math.ceil(this.height / 8);

    for (let k = 0; k < count; k++) {
      this.uniformI32[54] = startTick + k; // tick
      this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformF32.buffer, 0, UNIFORM_SIZE);

      const encoder = this.device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(this.tracePipeline);
      pass.setBindGroup(0, this.traceBindGroups![this.readIndex]);
      pass.dispatchWorkgroups(wgX, wgY);
      pass.end();
      this.device.queue.submit([encoder.finish()]);
      this.readIndex = 1 - this.readIndex;
    }

    // present the latest accumulation (now at accum[readIndex])
    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    pass.setPipeline(this.presentPipeline);
    pass.setBindGroup(0, this.presentBindGroups![this.readIndex]);
    pass.draw(3);
    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }

  async captureBlob(type = 'image/jpeg', quality = 0.95): Promise<Blob | null> {
    return new Promise((resolve) => {
      this.canvas.toBlob((blob) => resolve(blob), type, quality);
    });
  }

  private disposeSceneResources(): void {
    this.atlasTexture?.destroy();
    this.shapeBuffer?.destroy();
    this.bvhBuffer?.destroy();
    this.lightBuffer?.destroy();
    this.paletteBuffer?.destroy();
    this.materialBuffer?.destroy();
    this.atlasTexture = null;
    this.traceBindGroups = null;
  }

  dispose(): void {
    this.disposeSceneResources();
    this.accumTextures?.forEach((t) => t.destroy());
    this.uniformBuffer?.destroy();
    this.device?.destroy();
  }
}
