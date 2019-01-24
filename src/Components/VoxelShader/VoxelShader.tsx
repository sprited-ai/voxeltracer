import React from "react";
import { Shaders, Node, GLSL, Uniform } from "gl-react";
import NaiveVoxelPathTracer from '../../Shaders/NaiveVoxelPathTracer.glsl';
import VoxelArt from '../../Data/Models/VoxelArt';

interface VoxelShaderProps {
  eye: number[];
  viewMatrixInverse: Float32Array;
  projectionMatrixInverse: Float32Array;
  progress: number;
  models: VoxelArt[];
}

const shaders = Shaders.create({
  vt01: {
    frag: GLSL`${NaiveVoxelPathTracer}`
  }
});

const VoxelShader: React.SFC<VoxelShaderProps> = (props) => {
  const { eye, viewMatrixInverse, projectionMatrixInverse, progress, models } = props;
  const modelHashes = models.map((model, index) => {
    return {
      index,
      pos: model.pos.toArray(),
      size: model.size.toArray(),
      textureSize: model.textureSize.toArray(),
    };
  })
  const uniforms: any = {
    eye,
    progress,
    viewMatrixInverse,
    projectionMatrixInverse,
    models: modelHashes,
    modelCount: models.length
  };
  const uniformsOptions: any = {};
  models.forEach((model, index) => {
    uniforms[`modelTexture${index}`] = model.texture;
    uniformsOptions[`modelTexture${index}`] = {
      interpolation: 'nearest'
    };
  });
  return (
    <Node
      shader={shaders.vt01}
      uniforms={uniforms}
      uniformsOptions={uniformsOptions}
    />
  );
}

export default VoxelShader;
