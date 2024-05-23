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

    const viewer = {
        container: container,
        component: ref.current!,
        rerender
    };

    return viewer;
}


