import React from "react";
import { Shaders, Node, GLSL } from "gl-react";
import NaiveVoxelPathTracer from '../../Shaders/NaiveVoxelPathTracer.glsl';

interface VoxelShaderProps {
  eye: number[];
  matrixWorldInverse: Float32Array;
  projectionMatrixInverse: Float32Array;
  progress: number;
}

const shaders = Shaders.create({
  vt01: {
    frag: GLSL`${NaiveVoxelPathTracer}`
  }
});

const VoxelShader: React.SFC<VoxelShaderProps> = (props) => {
  const { eye, matrixWorldInverse, projectionMatrixInverse, progress } = props;
  return <Node shader={shaders.vt01} uniforms={{
    eye,
    matrixWorldInverse,
    projectionMatrixInverse,
    progress
  }} />;
}

export default VoxelShader;
