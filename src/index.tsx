import React from 'react';
import VoxelViewer from './Components/VoxelViewer/VoxelViewer';
import ReactDOM from 'react-dom';

export function initVoxelViewer({
    src,
    container
}: {
    src: string;
    container: HTMLElement;
}) {
    ReactDOM.render(<VoxelViewer key={src} src={src} />, container);
}


