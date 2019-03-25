import React from "react";
import { Shaders, GLSL, Uniform, NearestCopy } from "gl-react";
import NaiveVoxelPathTracer from '../../Shaders/NaiveVoxelPathTracer.glsl';
import MaterialArray from "../../Data/Arrays/MaterialArray";
import ndarray from 'ndarray';
import { Vector3, Matrix4 } from "three";
import EnhancedNode from "./EnhancedNode";
import ColorArray from "../../Data/Arrays/ColorArray";
import ShapeHash from "../../Data/Types/ShapeHash";

export const MAX_SHAPES = 64;

interface VoxelShaderProps {
  eye: number[];
  lightDir: Vector3;
  viewMatrixInverse: Float32Array;
  projectionMatrixInverse: Float32Array;
  tick: number;
  maxTick: number;
  resolution: number[];
  shapeHashes: ShapeHash[];
  packedTexture: ndarray;
  colors: ColorArray;
  materials: MaterialArray;
}

const shaders = Shaders.create({
  vt01: {
    frag: GLSL`${NaiveVoxelPathTracer}`
  }
});

const nullShapeHash: ShapeHash = {
  modelIndex: -1,
  transform: (new Matrix4()).toArray(),
  pos: [0, 0, 0],
  size: [0, 0, 0],
  byteOffset: 0
};

const VoxelShader: React.SFC<VoxelShaderProps> = (props) => {
  const {
    resolution,
    eye,
    viewMatrixInverse,
    projectionMatrixInverse,
    tick,
    maxTick,
    shapeHashes,
    packedTexture,
    colors,
    materials,
    lightDir
  } = props;

  const shapes: any[] = [];
  for (let i = 0; i < MAX_SHAPES; ++i) {
    const hash: ShapeHash = shapeHashes[i] || nullShapeHash;
    shapes.push(hash);
  }

  const uniforms: any = {
    eye,
    tick,
    maxTick,
    viewMatrixInverse,
    resolution,
    lightDir: lightDir.toArray(),
    projectionMatrixInverse,
    shapes,
    packedTextureSize: [packedTexture.shape[0], packedTexture.shape[1]],
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
