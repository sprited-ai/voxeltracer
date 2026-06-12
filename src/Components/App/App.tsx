import { useEffect, useState } from 'react';
import VoxelViewer from '../VoxelViewer/VoxelViewer';
import './App.css';

const defaultUrl = 'vox/pink_mini_store.vox';

interface HashState {
  src?: string;
  backend?: 'auto' | 'webgpu' | 'webgl2';
  maxSteps?: number;
  dpr?: number;
}

// Hash params beyond `src` exist for the golden-test harness
// (scripts/golden-test.mjs): backend, maxSteps, dpr.
function parseHash(): HashState {
  const params = new URLSearchParams(location.hash.slice(1));
  const backend = params.get('backend');
  const maxSteps = params.get('maxSteps');
  const dpr = params.get('dpr');
  return {
    src: params.get('src') ?? undefined,
    backend:
      backend === 'webgpu' || backend === 'webgl2' || backend === 'auto' ? backend : undefined,
    maxSteps: maxSteps ? parseInt(maxSteps, 10) : undefined,
    dpr: dpr ? parseFloat(dpr) : undefined,
  };
}

export default function App() {
  const [state, setState] = useState(parseHash());

  useEffect(() => {
    const onHashChange = () => setState(parseHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return (
    <div className="App">
      <VoxelViewer
        key={`${state.backend ?? 'auto'}:${state.maxSteps ?? ''}:${state.dpr ?? ''}`}
        src={state.src || defaultUrl}
        backend={state.backend}
        maxSteps={state.maxSteps}
        devicePixelRatio={state.dpr}
        onRendered={() => {
          (window as unknown as { __vtDone?: boolean }).__vtDone = true;
        }}
        onFileChange={(next: string) => {
          const params = new URLSearchParams(location.hash.slice(1));
          params.set('src', next);
          location.hash = params.toString();
        }}
      />
    </div>
  );
}
