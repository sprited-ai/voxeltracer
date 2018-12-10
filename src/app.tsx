import _ from 'lodash';

export function sum(a: number, b: number) {
    return a + b;
}

function component() {
    let element = document.createElement('div');

    // Lodash, currently included via a script, is required for this line to work
    element.innerHTML = _.join(['Hello', 'webpack'], ' ');

    return element;
}

// document.body.appendChild(component());

import React from 'react';
import ReactDOM from 'react-dom';
import { Shaders, Node, GLSL } from "gl-react";
import { Surface } from "gl-react-dom";

const shaders = Shaders.create({
    helloBlue: {
        frag: GLSL`
            precision highp float;
            varying vec2 uv;
            uniform float blue;
            void main() {
                gl_FragColor = vec4(uv.x, uv.y, blue, 1.0);
            }
        `
    }
});

class VoxelViewer extends React.Component {
    
    render() {
        return (
            // @ts-ignore
            <Surface width={300} height={300}>
                <Node shader={shaders.helloBlue} uniforms={{ blue: 0.5 }} />
            </Surface>
        );
    }

}




  ReactDOM.render(
    <VoxelViewer />,
    document.getElementById('root')
  );