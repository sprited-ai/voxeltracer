import React from "react";
import { Shaders, GLSL, Uniform, NearestCopy, Node } from "gl-react";
import NaiveVoxelPathTracer from '../../Shaders/NaiveVoxelPathTracer.glsl';
import sampleShader from '../../Shaders/sampleShader.glsl';
import MaterialArray from "../../Data/Arrays/MaterialArray";
import ndarray from 'ndarray';
import { Vector3, Matrix4, Matrix3, Color } from "three";
import EnhancedNode from "./EnhancedNode";
import ColorArray from "../../Data/Arrays/ColorArray";
import ShapeHash from "../../Data/Types/ShapeHash";

export const MAX_SHAPES = 64;

interface VoxelShaderProps {
  eye: number[];
  lightDir: Vector3;
  skyColor: Color;
  lightColor: Color;
  groundColor: Color;
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

console.log("shader", NaiveVoxelPathTracer);
// console.log("shader", GLSL`${NaiveVoxelPathTracer}`);  

const shaders = Shaders.create({
  vt01: {
    frag: GLSL`${NaiveVoxelPathTracer}`,
  },
  sampleShader: {
    frag: GLSL`${sampleShader}`
  }
});

const nullShapeHash: ShapeHash = {
  modelIndex: -1,
  rotation: (new Matrix3()).toArray(),
  translation: (new Vector3()).toArray(),
  pos: (new Vector3()).toArray(),
  size: (new Vector3()).toArray(),
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
    lightDir,
    lightColor,
    groundColor,
    skyColor
  } = props;

  const shapes: any[] = [];
  for (let i = 0; i < MAX_SHAPES; ++i) {
    const hash: ShapeHash = shapeHashes[i] || nullShapeHash;
    shapes.push(hash);
  }
  
  // console.log("VoxelShader", props);

  const uniforms: any = {
    eye,
    tick,
    maxTick,
    viewMatrixInverse,
    resolution,
    lightDir: lightDir.toArray(),
    lightColor: lightColor.toArray(),
    groundColor: groundColor.toArray(),
    skyColor: skyColor.toArray(),
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
  // return (
  //   <NearestCopy>
  //     <Node shader={shaders.sampleShader}></Node>
  //   </NearestCopy>
  // );
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
