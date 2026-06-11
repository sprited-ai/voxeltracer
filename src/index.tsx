import { createRoot, Root } from 'react-dom/client';
import VoxelViewer from './Components/VoxelViewer/VoxelViewer';

const roots = new WeakMap<HTMLElement, Root>();

export function initVoxelViewer({
  src,
  container,
}: {
  src: string;
  container: HTMLElement;
}) {
  let root = roots.get(container);
  if (!root) {
    root = createRoot(container);
    roots.set(container, root);
  }
  root.render(<VoxelViewer key={src} src={src} />);

  function rerender({ src: nextSrc }: { src: string }) {
    root!.render(<VoxelViewer key={nextSrc} src={nextSrc} />);
  }

  function getCanvas() {
    return container.querySelector('canvas') as HTMLCanvasElement;
  }

  async function captureAsBlob() {
    return await canvasToBlob(getCanvas());
  }

  async function captureAndDownload() {
    const blob = await canvasToBlob(getCanvas());
    if (blob) {
      downloadBlob(blob, 'voxelviewer.jpg');
    }
  }

  async function captureAndSetAsInputFile(fileInput: HTMLInputElement) {
    const blob = await canvasToBlob(getCanvas());
    if (blob) {
      setBlobAsFileInput(blob, 'voxelviewer.jpg', fileInput);
    }
  }

  return {
    container,
    captureAsBlob,
    captureAndDownload,
    captureAndSetAsInputFile,
    getCanvas,
    rerender,
  };
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<null | Blob> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.95);
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.style.display = 'none';
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function setBlobAsFileInput(blob: Blob, filename: string, fileInput: HTMLInputElement) {
  const file = new File([blob], filename, { type: blob.type });
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  fileInput.files = dataTransfer.files;
  fileInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
}
