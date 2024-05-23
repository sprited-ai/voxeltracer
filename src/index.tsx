import React from 'react';
import VoxelViewer, { VoxelViewerProps } from './Components/VoxelViewer/VoxelViewer';
import ReactDOM from 'react-dom';

export function initVoxelViewer({
    src,
    container
}: {
    src: string;
    container: HTMLElement;
}) {
    const ref = React.createRef<React.Component<VoxelViewerProps, any, any>>();
    
    ReactDOM.render(<VoxelViewer key={src} src={src} ref={ref} />, container);

    function rerender({ src }: { src: string }) {
        ReactDOM.render(<VoxelViewer key={src} src={src} ref={ref} />, container);
    }

    function getCanvas() {
        return container.querySelector("canvas") as HTMLCanvasElement;
    }

    async function captureAsBlob() {
        return await canvasToBlob(getCanvas());
    }

    async function captureAndDownload() {
        const blob = await canvasToBlob(getCanvas());
        if (blob) {
            downloadBlob(blob, "voxelviewer.jpg");
        }
    }

    async function captureAndSetAsInputFile(fileInput: HTMLInputElement) {
        const blob = await canvasToBlob(getCanvas());
        if (blob) {
            setBlobAsFileInput(blob, "voxelviewer.jpg", fileInput)
        }
    }

    const viewer = {
        container: container,
        componentRef: ref,
        captureAsBlob,
        captureAndDownload,
        captureAndSetAsInputFile,
        getCanvas,
        rerender
    };

    return viewer;
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<null | Blob> {
    return new Promise((resolve) => {
        console.log("!!!takeSnapshot")
        function handleBlob(blob: Blob | null) {
            resolve(blob);
        }
        canvas.toBlob(handleBlob, "image/jpeg", 0.95);
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
    // Create a File from the Blob
    const file = new File([blob], filename, { type: blob.type });

    // Create a DataTransfer object
    const dataTransfer = new DataTransfer();
    // Append the file to the DataTransfer object
    dataTransfer.items.add(file);

    // Set the files property of the file input element
    fileInput.files = dataTransfer.files;

    // Manually trigger the change event
    const event = new Event('change', {
        bubbles: true,
        cancelable: true
    });
    fileInput.dispatchEvent(event);
}