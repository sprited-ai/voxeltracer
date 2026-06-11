import { useEffect, useState } from 'react';
import VoxelViewer from '../VoxelViewer/VoxelViewer';
import './App.css';

const defaultUrl = 'vox/pink_mini_store.vox';

function parseHash(): { src?: string } {
  const params = new URLSearchParams(location.hash.slice(1));
  return { src: params.get('src') ?? undefined };
}

export default function App() {
  const [{ src }, setState] = useState(parseHash());

  useEffect(() => {
    const onHashChange = () => setState(parseHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return (
    <div className="App">
      <VoxelViewer
        src={src || defaultUrl}
        onFileChange={(next: string) => {
          const params = new URLSearchParams(location.hash.slice(1));
          params.set('src', next);
          location.hash = params.toString();
        }}
      />
    </div>
  );
}
