import React from "react";
import { Shaders, GLSL, Uniform, NearestCopy } from "gl-react";
import NaiveVoxelPathTracer from '../../Shaders/NaiveVoxelPathTracer.glsl';
import VoxelArt from '../../Data/Models/VoxelArt';
import MaterialArray from "../../Data/Arrays/MaterialArray";
import ndarray from 'ndarray';
import { Vector3 } from "three";
import EnhancedNode from "./EnhancedNode";
import ColorArray from "../../Data/Arrays/ColorArray";
import { ModelHash } from "../../Data/Types/ModelHash";

// Always use one model for now.
export const MAX_MODELS = 1;

interface VoxelShaderProps {
  eye: number[];
  lightDir: Vector3;
  viewMatrixInverse: Float32Array;
  projectionMatrixInverse: Float32Array;
  tick: number;
  maxTick: number;
  resolution: number[];
  modelHashes: ModelHash[];
  packedTexture: ndarray;
  colors: ColorArray;
  materials: MaterialArray;
}

const shaders = Shaders.create({
  vt01: {
    frag: GLSL`${NaiveVoxelPathTracer}`
  }
});

const VoxelShader: React.SFC<VoxelShaderProps> = (props) => {
  const {
    resolution,
    eye,
    viewMatrixInverse,
    projectionMatrixInverse,
    tick,
    maxTick,
    modelHashes,
    packedTexture,
    colors,
    materials,
    lightDir
  } = props;
  const { shape } = packedTexture;
  const models: any[] = [];
  for (let i = 0; i < MAX_MODELS; ++i) {
    const hash: ModelHash = modelHashes[i] || {
      index: -1,
      pos: [0,0,0],
      size: [0,0,0],
      byteOffset: 0
    };
    models.push(hash);
  }

  const uniforms: any = {
    eye,
    tick,
    maxTick,
    viewMatrixInverse,
    resolution,
    lightDir: lightDir.toArray(),
    projectionMatrixInverse,
    models,
    packedTextureSize: [shape[0], shape[1]],
    packedTexture: packedTexture,
    colorTexture: colors.colorTexture,
    materialTexture: materials.materialTexture,
    previousFrameBuffer: Uniform.Backbuffer
  };
  const uniformsOptions: any = {
    packedTexture: {
      interpolation: 'nearest'
    },
    colorTexture: {
      interpolation: 'nearest'
    },
    materialTexture: {
      interpolation: 'nearest'
    },
    previousFrameBuffer: {
      interpolation: 'nearest'
    }
  };
  return (
    <NearestCopy>
      <EnhancedNode
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
