import React from "react";
import { Shaders, Node, GLSL } from "gl-react";

interface VoxelShaderProps {
  eye: number[];
  matrixWorldInverse: Float32Array;
  projectionMatrixInverse: Float32Array;
}

const shaders = Shaders.create({
  vt01: {
    frag: GLSL`
      precision highp float;
      varying vec2 uv;
      uniform mat4 matrixWorldInverse;
      uniform mat4 projectionMatrixInverse;
      uniform vec3 eye;
      void main() {
        // TODO Optimize by pre-computing matrices or initial rays itself
        vec4 q = matrixWorldInverse * projectionMatrixInverse * vec4(uv - 0.5, 0.0, 1.0);
        vec3 initialRay = normalize(q.xyz / q.w - eye);
        gl_FragColor = projectionMatrixInverse * vec4(initialRay, 1.0);
      }
    `
  }
});

export default class VoxelShader extends React.Component<VoxelShaderProps> {

  render() {

    const { eye, matrixWorldInverse, projectionMatrixInverse } = this.props;
    // console.log(projectionMatrixInverse.multiplyVector4(new Vector4(1,1,0,1)));
    return (
      <Node shader={shaders.vt01} uniforms={{
        eye,
        matrixWorldInverse,
        projectionMatrixInverse
      }} />
    );

  }

}
