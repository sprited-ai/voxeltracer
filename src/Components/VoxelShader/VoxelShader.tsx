import React from "react";
import { Shaders, Node, GLSL } from "gl-react";
import NaiveVoxelPathTracer from '../../Shaders/NaiveVoxelPathTracer.glsl';
import VoxelArt from '../../Data/Models/VoxelArt';

interface VoxelShaderProps {
  eye: number[];
  viewMatrixInverse: Float32Array;
  projectionMatrixInverse: Float32Array;
  progress: number;
  model: VoxelArt;
}

const shaders = Shaders.create({
  vt01: {
    frag: GLSL`${NaiveVoxelPathTracer}`
  }
});

const VoxelShader: React.SFC<VoxelShaderProps> = (props) => {
  const { eye, viewMatrixInverse, projectionMatrixInverse, progress, model } = props;
  const modelSize = model.size.toArray();
  return <Node shader={shaders.vt01} uniforms={{
    eye,
    viewMatrixInverse,
    projectionMatrixInverse,
    modelSize,
    progress
  }} />;
}

export default VoxelShader;
