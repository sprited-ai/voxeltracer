import { PerspectiveCamera, Sphere, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import Loader from '../Data/Loaders/Loader';
import VoxelScene from '../Data/Models/VoxelScene';
import { VoxelRenderer, MAX_TICK } from '../Renderer/VoxelRenderer';
import { computeSceneBounds } from './sceneBounds';

export interface VoxelTracerOptions {
  /** Element the tracer creates its canvas in. Also receives orbit controls. */
  container: HTMLElement;
  /** .vox file URL or File to load immediately. */
  src?: string | File;
  devicePixelRatio?: number;
  /** Stop accumulating after this many ticks (default 1000). */
  maxSteps?: number;
  /** Frame the camera to the scene bounds on load (default true). */
  autoFrame?: boolean;
  /** Throttle trace ticks; Infinity (default) = every frame, 0 = paused. */
  ticksPerSecond?: number;
  onTick?: (tick: number, msElapsed: number) => void;
  onSceneLoaded?: (scene: VoxelScene) => void;
  onRendered?: () => void;
  onError?: (error: unknown) => void;
}

export interface VoxelTracer {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: VoxelRenderer;
  /** Loads a .vox file (URL or File) and swaps the scene. */
  load(src: string | File): Promise<VoxelScene>;
  captureAsBlob(type?: string, quality?: number): Promise<Blob | null>;
  /** Throttle trace ticks; Infinity = every frame, 0 = paused. */
  setTicksPerSecond(tps: number): void;
  dispose(): void;
}

/**
 * Framework-agnostic entry point: creates a canvas inside `container`,
 * wires camera controls, resizing, and the render loop. Works from plain
 * <script> tags, React, Vue, or anything else that can hand over a DOM
 * element.
 */
export function createVoxelTracer(options: VoxelTracerOptions): VoxelTracer {
  const { container } = options;
  const onError = options.onError ?? ((e: unknown) => console.error('[voxeltracer]', e));

  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  container.appendChild(canvas);

  const renderer = new VoxelRenderer(canvas, {
    maxTick: options.maxSteps ?? MAX_TICK,
    ticksPerSecond: options.ticksPerSecond,
    onTick: options.onTick,
    onRendered: options.onRendered,
  });

  const camera = new PerspectiveCamera(60, 1, 0.01, 1000);
  camera.position.set(0, 50, 100);

  const controls = new OrbitControls(camera, container);
  controls.target = new Vector3(0, 30, 0);
  controls.update();

  const pixelRatio = options.devicePixelRatio ?? window.devicePixelRatio ?? 1;
  const resize = () => {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, pixelRatio);
    renderer.setCamera(camera);
  };
  resize();

  const observer = new ResizeObserver(resize);
  observer.observe(container);

  const onControlsChange = () => renderer.setCamera(camera);
  controls.addEventListener('change', onControlsChange);

  renderer.start();

  const loader = new Loader();
  let loadGeneration = 0;

  function frameScene(scene: VoxelScene) {
    const bounds = computeSceneBounds(scene);
    const sphere = bounds.getBoundingSphere(new Sphere());
    const distance = (sphere.radius / Math.tan(((camera.fov * Math.PI) / 180) / 2)) * 1.1;
    camera.position
      .copy(sphere.center)
      .add(new Vector3(0, 0.45, 1).normalize().multiplyScalar(distance));
    controls.target.copy(sphere.center);
    controls.update();
    renderer.setCamera(camera);
  }

  async function load(src: string | File): Promise<VoxelScene> {
    const generation = ++loadGeneration;
    const scene = await loader.load(src);
    if (generation === loadGeneration) {
      renderer.setScene(scene);
      if (options.autoFrame !== false) {
        frameScene(scene);
      }
      options.onSceneLoaded?.(scene);
    }
    return scene;
  }

  if (options.src !== undefined) {
    load(options.src).catch(onError);
  }

  return {
    canvas,
    renderer,
    load,
    captureAsBlob: (type, quality) => renderer.captureBlob(type, quality),
    setTicksPerSecond(tps: number) {
      renderer.ticksPerSecond = tps;
    },
    dispose() {
      observer.disconnect();
      controls.removeEventListener('change', onControlsChange);
      controls.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
