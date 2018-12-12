import React from "react";
import { Shaders, Node, GLSL } from "gl-react";
import { randomFunction } from "../../Shaders/randomFunction";

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
      ${randomFunction}
      void main() {
        // // TODO Optimize by pre-computing matrices or initial rays itself
        // vec4 q = matrixWorldInverse * projectionMatrixInverse * vec4((uv - 0.5) * 2.0, 0.0, 1.0);
        // vec3 initialRay = normalize(q.xyz / q.w - eye);
        // gl_FragColor = projectionMatrixInverse * vec4(initialRay * 255.0, 1.0);

        float rand = random(vec3(12.9898, 78.233, 151.7182), uv.x);
        gl_FragColor = vec4(rand, rand, rand, 1.0);
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
