import React from "react";
import { Shaders, Node, GLSL } from "gl-react";
import NaiveVoxelPathTracer from '../../Shaders/NaiveVoxelPathTracer.glsl';
import ReactAnimationFrame from 'react-animation-frame';

interface VoxelShaderProps {
  eye: number[];
  matrixWorldInverse: Float32Array;
  projectionMatrixInverse: Float32Array;
}

interface VoxelShaderState {
  progress: number;
}

const shaders = Shaders.create({
  vt01: {
    frag: GLSL`${NaiveVoxelPathTracer}`
  }
});

class VoxelShader extends React.Component<VoxelShaderProps, VoxelShaderState> {
  constructor(props:VoxelShaderProps){
    super(props);
    this.state = {
      progress: 0
    };
  }

  endAnimation(): void {
    (this.props as any).endAnimation();
  }

  onAnimationFrame(time: number) {
    const { progress } = this.state;
    this.setState({ progress: progress + 0.01 });
    if (progress >= 1) {
      this.endAnimation();
    }
  }

  render() {

    const { eye, matrixWorldInverse, projectionMatrixInverse } = this.props;
    const { progress } = this.state;
    return (
      <Node shader={shaders.vt01} uniforms={{
        eye,
        matrixWorldInverse,
        projectionMatrixInverse,
        progress
      }} />
    );

  }

}

export default ReactAnimationFrame(VoxelShader);
