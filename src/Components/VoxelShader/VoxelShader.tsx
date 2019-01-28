import React from "react";
import { Shaders, Node, GLSL, Uniform } from "gl-react";
import NaiveVoxelPathTracer from '../../Shaders/NaiveVoxelPathTracer.glsl';
import VoxelArt from '../../Data/Models/VoxelArt';
import MaterialArray from "../../Data/Arrays/MaterialArray";
import ndarray from 'ndarray';

export const MAX_MODELS = 8;

interface VoxelShaderProps {
  eye: number[];
  viewMatrixInverse: Float32Array;
  projectionMatrixInverse: Float32Array;
  progress: number;
  models: VoxelArt[];
  materials: MaterialArray;
}

const shaders = Shaders.create({
  vt01: {
    frag: GLSL`${NaiveVoxelPathTracer}`
  }
});

const getModelHashes = function (models: VoxelArt[]): any[] {
  const nullModel = new VoxelArt();
  const modelHashes = [];
  for (let i = 0; i < MAX_MODELS; ++i) {
    const model = models[i] || nullModel;
    const index = model === nullModel ? -1 : i;
    modelHashes.push({
      index,
      pos: model.pos.toArray(),
      size: model.size.toArray(),
      textureSize: model.textureSize.toArray(),
    });
  }
  return modelHashes;
};

const VoxelShader: React.SFC<VoxelShaderProps> = (props) => {
  const { eye, viewMatrixInverse, projectionMatrixInverse, progress, models, materials } = props;
  const uniforms: any = {
    eye,
    progress,
    viewMatrixInverse,
    projectionMatrixInverse,
    models: getModelHashes(models),
    materialColorTexture: materials.colorTexture
  };
  const uniformsOptions: any = {
    materialColorTexture: {
      interpolation: 'nearest'
    }
  };
  for (let i = 0; i < MAX_MODELS; ++i) {
    const model = models[i];
    let texture = model ? model.texture : ndarray(new Uint8Array(4), [1, 1, 4]);
    uniforms[`modelTexture${i}`] = texture;
    uniformsOptions[`modelTexture${i}`] = {
      interpolation: 'nearest'
    };
  }

  return (
    <Node
      shader={shaders.vt01}
      uniforms={uniforms}
      uniformsOptions={uniformsOptions}
      ignoreUnusedUniforms={true}
    />
  );
}

export default VoxelShader;
