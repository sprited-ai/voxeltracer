import React from "react";
import { Shaders, Node, GLSL, Uniform, NearestCopy } from "gl-react";
import NaiveVoxelPathTracer from '../../Shaders/NaiveVoxelPathTracer.glsl';
import VoxelArt from '../../Data/Models/VoxelArt';
import MaterialArray from "../../Data/Arrays/MaterialArray";
import ndarray from 'ndarray';

export const MAX_MODELS = 8;

interface VoxelShaderProps {
  eye: number[];
  viewMatrixInverse: Float32Array;
  projectionMatrixInverse: Float32Array;
  tick: number;
  maxTick: number;
  resolution: number[];
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
  const { resolution, eye, viewMatrixInverse, projectionMatrixInverse, tick, maxTick, models, materials } = props;
  const uniforms: any = {
    eye,
    tick,
    maxTick,
    viewMatrixInverse,
    resolution,
    projectionMatrixInverse,
    models: getModelHashes(models),
    materialColorTexture: materials.colorTexture,
    previousFrameBuffer: Uniform.Backbuffer
  };
  const uniformsOptions: any = {
    materialColorTexture: {
      interpolation: 'nearest'
    },
    previousFrameBuffer: {
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
    <NearestCopy>
      <Node
        shader={shaders.vt01}
        uniforms={uniforms}
        uniformsOptions={uniformsOptions}
        ignoreUnusedUniforms={true}
        backbuffering
      />
    </NearestCopy>
  );
}

export default VoxelShader;
