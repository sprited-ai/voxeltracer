import { useEffect, useRef, useState } from 'react';
import Loader from '../../Data/Loaders/Loader';
import VoxelScene from '../../Data/Models/VoxelScene';
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
  const { src, onFileChange } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState<VoxelScene | null>(null);
  const [status, setStatus] = useState('Loading…');

  useEffect(() => {
    let cancelled = false;
    const loader = new Loader();
    setStatus('Loading…');
    loader.load(src).then((loaded: VoxelScene) => {
      if (cancelled) return;
      setScene(loaded);
      setStatus(`Loaded ${loaded.models.length} model(s) — renderer migration in progress`);
    });
    return () => {
      cancelled = true;
    };
  }, [src]);

  const filenameText = src instanceof File ? src.name : src;
  const voxelSize = scene && scene.models.length > 0 ? scene.models[0].size : undefined;
  const voxelSizeText = voxelSize ? `Voxel Size: ${voxelSize.x}x${voxelSize.y}x${voxelSize.z}` : '';

  return (
    <div className="voxel-viewer">
      <div className="top-bar">VoxelTracer V1.0</div>
      <div className="voxel-viewer-surface-container" ref={containerRef}>
        <canvas style={{ width: '100%', height: '100%' }} />
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
        <div>{status}</div>
      </div>
    </div>
  );
}
