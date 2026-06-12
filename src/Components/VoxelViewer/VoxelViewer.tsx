import { useEffect, useRef, useState } from 'react';
import VoxelScene from '../../Data/Models/VoxelScene';
import { createVoxelTracer, VoxelTracer } from '../../core/createVoxelTracer';
import { MAX_TICK } from '../../Renderer/VoxelRenderer';
import { availableVoxelFiles } from './voxFileList';
import './VoxelViewer.css';

export interface VoxelViewerProps {
  src: string | File;
  devicePixelRatio?: number;
  backend?: 'auto' | 'webgpu' | 'webgl2';
  onRendered?: () => void;
  onFileChange?: (src: string) => void;
  maxSteps?: number;
}

const SPEED_OPTIONS: Array<[label: string, tps: number]> = [
  ['full', Infinity],
  ['60 tps', 60],
  ['30 tps', 30],
  ['10 tps', 10],
  ['paused', 0],
];

export default function VoxelViewer(props: VoxelViewerProps) {
  const { src, onFileChange, onRendered, maxSteps, devicePixelRatio, backend } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const tracerRef = useRef<VoxelTracer | null>(null);
  const onRenderedRef = useRef(onRendered);
  onRenderedRef.current = onRendered;

  const [scene, setScene] = useState<VoxelScene | null>(null);
  const [status, setStatus] = useState('Loading…');
  const [error, setError] = useState<string | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [speed, setSpeed] = useState('full');
  const [nee, setNee] = useState(true);

  // Tracer lifecycle (mount once)
  useEffect(() => {
    const maxTick = maxSteps ?? MAX_TICK;
    try {
      tracerRef.current = createVoxelTracer({
        container: containerRef.current!,
        devicePixelRatio,
        backend,
        maxSteps: maxTick,
        onTick: (tick, ms) => {
          const fps = ms > 0 ? ((tick / ms) * 1000).toFixed(2) : '0';
          setStatus(
            tick >= maxTick
              ? `completed in ${Math.round(ms)}ms — ${fps} tps`
              : `rendering ${tick}/${maxTick} — ${fps} tps`
          );
        },
        onRendered: () => onRenderedRef.current?.(),
      });
    } catch (e) {
      setError(`WebGL2 is required: ${String(e)}`);
      return;
    }
    return () => {
      tracerRef.current?.dispose();
      tracerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Backtick toggles the debug panel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.key === '`') setDebugOpen((open) => !open);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Scene loading
  useEffect(() => {
    if (!tracerRef.current) return;
    let cancelled = false;
    setStatus('loading…');
    tracerRef.current
      .load(src)
      .then((loaded) => {
        if (!cancelled) {
          setScene(loaded);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  const filenameText = src instanceof File ? src.name : src;
  const voxelSize = scene && scene.models.length > 0 ? scene.models[0].size : undefined;
  const voxelSizeText = voxelSize
    ? `${voxelSize.x}×${voxelSize.y}×${voxelSize.z} · ${scene!.models.length} model(s)`
    : '';

  return (
    <div className="voxel-viewer">
      <div className="voxel-viewer-surface-container" ref={containerRef} />
      {debugOpen && (
        <div className="debug-panel">
          <div className="debug-panel-title">voxeltracer · debug</div>
          <select value={filenameText} onChange={(e) => onFileChange?.(e.target.value)}>
            {availableVoxelFiles.map((filename) => (
              <option key={filename} value={filename}>
                {filename}
              </option>
            ))}
          </select>
          <div>{voxelSizeText}</div>
          <div>{error ?? status}</div>
          <div>
            backend: {tracerRef.current?.renderer.backendKind ?? '—'}
            {tracerRef.current?.renderer.fallbackReason
              ? ` (↓ ${tracerRef.current.renderer.fallbackReason})`
              : ''}
          </div>
          <label>
            <input
              type="checkbox"
              checked={nee}
              onChange={(e) => {
                setNee(e.target.checked);
                const renderer = tracerRef.current?.renderer;
                if (renderer) renderer.emissiveSampling = e.target.checked;
              }}
            />{' '}
            emissive NEE
          </label>
          <label>
            speed{' '}
            <select
              value={speed}
              onChange={(e) => {
                const label = e.target.value;
                setSpeed(label);
                const option = SPEED_OPTIONS.find(([l]) => l === label);
                if (option) tracerRef.current?.setTicksPerSecond(option[1]);
              }}
            >
              {SPEED_OPTIONS.map(([label]) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
