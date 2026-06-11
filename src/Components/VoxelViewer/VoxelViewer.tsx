import { useEffect, useRef, useState } from 'react';
import { PerspectiveCamera, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import Loader from '../../Data/Loaders/Loader';
import VoxelScene from '../../Data/Models/VoxelScene';
import { VoxelRenderer, MAX_TICK } from '../../Renderer/VoxelRenderer';
import { availableVoxelFiles } from './voxFileList';
import './VoxelViewer.css';

export interface VoxelViewerProps {
  src: string | File;
  devicePixelRatio?: number;
  onRendered?: () => void;
  onFileChange?: (src: string) => void;
  maxSteps?: number;
}

export default function VoxelViewer(props: VoxelViewerProps) {
  const { src, onFileChange, onRendered, maxSteps, devicePixelRatio } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<VoxelRenderer | null>(null);
  const onRenderedRef = useRef(onRendered);
  onRenderedRef.current = onRendered;

  const [scene, setScene] = useState<VoxelScene | null>(null);
  const [status, setStatus] = useState('Loading…');
  const [error, setError] = useState<string | null>(null);

  // Renderer lifecycle (mount once)
  useEffect(() => {
    const canvas = canvasRef.current!;
    const container = containerRef.current!;

    let renderer: VoxelRenderer;
    try {
      renderer = new VoxelRenderer(canvas, {
        maxTick: maxSteps ?? MAX_TICK,
        onTick: (tick, ms) => {
          const max = renderer.maxTick;
          const fps = ms > 0 ? ((tick / ms) * 1000).toFixed(2) : '0';
          setStatus(
            tick >= max
              ? `Rendering Completed (took ${Math.round(ms)}ms) — FPS: ${fps}`
              : `Rendering (${tick}/${max}) — FPS: ${fps}`
          );
        },
        onRendered: () => onRenderedRef.current?.(),
      });
    } catch (e) {
      console.error('VoxelRenderer init failed', e);
      setError(`WebGL2 is required: ${String(e)}`);
      return;
    }
    rendererRef.current = renderer;

    const camera = new PerspectiveCamera(60, 1, 0.01, 1000);
    camera.position.set(0, 50, 100);

    const controls = new OrbitControls(camera, container);
    controls.target = new Vector3(0, 30, 0);
    controls.update();

    const pixelRatio = devicePixelRatio ?? window.devicePixelRatio ?? 1;
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

    return () => {
      observer.disconnect();
      controls.removeEventListener('change', onControlsChange);
      controls.dispose();
      renderer.dispose();
      rendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scene loading
  useEffect(() => {
    let cancelled = false;
    setStatus('Loading…');
    setError(null);
    new Loader()
      .load(src)
      .then((loaded: VoxelScene) => {
        if (cancelled) return;
        setScene(loaded);
        rendererRef.current?.setScene(loaded);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  const filenameText = src instanceof File ? src.name : src;
  const voxelSize = scene && scene.models.length > 0 ? scene.models[0].size : undefined;
  const voxelSizeText = voxelSize
    ? `Voxel Size: ${voxelSize.x}x${voxelSize.y}x${voxelSize.z} (${scene!.models.length} models)`
    : '';

  return (
    <div className="voxel-viewer">
      <div className="top-bar">VoxelTracer V1.0</div>
      <div className="voxel-viewer-surface-container" ref={containerRef}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>
      <div className="status-panel">
        <div>
          <select value={filenameText} onChange={(e) => onFileChange?.(e.target.value)}>
            {availableVoxelFiles.map((filename) => (
              <option key={filename} value={filename}>
                {filename}
              </option>
            ))}
          </select>
        </div>
        <div>{voxelSizeText}</div>
        <div>{error ?? status}</div>
      </div>
    </div>
  );
}
