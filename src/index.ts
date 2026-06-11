export { createVoxelTracer } from './core/createVoxelTracer';
export type { VoxelTracer, VoxelTracerOptions } from './core/createVoxelTracer';
export { VoxelRenderer, MAX_TICK } from './Renderer/VoxelRenderer';
export type { VoxelRendererOptions } from './Renderer/VoxelRenderer';
export { default as Loader } from './Data/Loaders/Loader';
export { default as VoxelScene } from './Data/Models/VoxelScene';

import { createVoxelTracer, VoxelTracer } from './core/createVoxelTracer';

/**
 * Backwards-compatible API from the voxelviewer "librarify" era.
 * Prefer createVoxelTracer() for new code.
 */
export function initVoxelViewer({ src, container }: { src: string; container: HTMLElement }) {
  const tracer: VoxelTracer = createVoxelTracer({ container, src });

  function getCanvas() {
    return tracer.canvas;
  }

  async function captureAsBlob() {
    return tracer.captureAsBlob();
  }

  async function captureAndDownload() {
    const blob = await tracer.captureAsBlob();
    if (blob) {
      downloadBlob(blob, 'voxeltracer.jpg');
    }
  }

  async function captureAndSetAsInputFile(fileInput: HTMLInputElement) {
    const blob = await tracer.captureAsBlob();
    if (blob) {
      setBlobAsFileInput(blob, 'voxeltracer.jpg', fileInput);
    }
  }

  function rerender({ src: nextSrc }: { src: string }) {
    void tracer.load(nextSrc);
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
