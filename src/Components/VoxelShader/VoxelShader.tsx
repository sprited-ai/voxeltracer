import React from "react";
import { Shaders, Node, GLSL } from "gl-react";
import { Vector3 } from "three";

interface VoxelShaderProps {
  eye: Readonly<THREE.Vector3>;
  matrixWorldInverse: Readonly<THREE.Matrix4>;
  projectionMatrixInverse: Readonly<THREE.Matrix4>;
}

const shaders = Shaders.create({
  helloBlue: {
    frag: GLSL`
      precision highp float;
      varying vec2 uv;
      uniform float blue;
      uniform mat4 matrixWorldInverse;
      uniform mat4 projectionMatrixInverse;
      uniform vec3 eye;
      void main() {
        // TODO Optimize by pre-computing matrices or initial rays itself
        vec4 q = matrixWorldInverse * projectionMatrixInverse * vec4(uv - 0.5, 0.0, 1.0);
        vec3 initialRay = normalize(q.xyz / q.w - eye);
        gl_FragColor = projectionMatrixInverse * vec4(initialRay * 255.0, 1.0);
      }
    `
  }
});

export default class VoxelShader extends React.Component<VoxelShaderProps> {
  render() {
    const { eye, matrixWorldInverse, projectionMatrixInverse } = this.props;
    // console.log(projectionMatrixInverse.multiplyVector4(new Vector4(1,1,0,1)));
    return (
      <Node shader={shaders.helloBlue} uniforms={{
        blue: 0,
        eye: eye.toArray(),
        matrixWorldInverse: matrixWorldInverse.elements,
        projectionMatrixInverse: projectionMatrixInverse.elements
      }} />
    );

  }
}
