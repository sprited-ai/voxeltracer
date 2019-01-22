import React from "react";
import * as THREE from 'three';
import { Scene, PerspectiveCamera, Vector3, Vector2 } from "three";
import { Surface } from "gl-react-dom";
import VoxelShader from '../VoxelShader/VoxelShader';
import ReactAnimationFrame from 'react-animation-frame';
import VoxelArt from "../../Data/Models/VoxelArt";

const OrbitControls = require('three-orbit-controls')(THREE);

interface OrbitControls extends THREE.OrbitControls {}

interface VoxelViewerProps { }

interface VoxelViewerState {
  progress: number;
  eye: number[];
  viewMatrixInverse: Float32Array;
  projectionMatrixInverse: Float32Array;
  model: VoxelArt;
}

class VoxelViewer extends React.Component<VoxelViewerProps, VoxelViewerState> {
  scene: Scene;
  camera: PerspectiveCamera;
  orbitControls?: OrbitControls;

  constructor(props: VoxelViewerProps) {
    super(props);
    this.scene = new Scene();
    this.camera = new PerspectiveCamera(45, 1, 0.01, 1000);
    this.camera.position.set(0, 0, 10);
    this.camera.lookAt(new Vector3(0, 0, 0));

    const model = new VoxelArt(new Vector3(4,4,4));

    this.state = {
      model,
      progress: 0,
      eye: this.camera.position.toArray(),
      viewMatrixInverse: this.camera.matrixWorld.elements,
      //@ts-ignore
      projectionMatrixInverse: this.camera.projectionMatrixInverse.elements
    };
  }

  startAnimation(): void {
    (this.props as any).startAnimation();
  }

  endAnimation(): void {
    (this.props as any).endAnimation();
  }

  didOrbit = (event: Event) => {
    this.cameraDidUpdate();
  }

  cameraDidUpdate() {
    this.endAnimation();

    // TODO: Figure out why this is needed.
    // Ideally, this should have been handled by the Orbit controlls.
    this.camera.lookAt(new Vector3(0, 0, 0));

    this.setState({
      progress: 0,
      eye: this.camera.position.toArray(),
      viewMatrixInverse: this.camera.matrixWorld.elements,
      //@ts-ignore
      projectionMatrixInverse: this.camera.projectionMatrixInverse.elements
    });
    this.startAnimation();
  }

  componentDidMount() {
    const orbitControls: OrbitControls = this.orbitControls = new OrbitControls(this.camera);
    orbitControls.addEventListener('change', this.didOrbit);
  }

  componentWillUnmount() {

    if (this.orbitControls) {
      this.orbitControls.removeEventListener('change', this.didOrbit);
      this.orbitControls.dispose();
      delete this.orbitControls;
    }

  }

  onAnimationFrame(time: number) {
    const { progress } = this.state;
    this.setState({ progress: progress + 0.1 });
    if (progress >= 1) {
      this.endAnimation();
    }
  }

  render() {
    // const eye: Vector3 = this.camera.position;
    // const viewMatrixInverse: Matrix4 = this.camera.viewMatrixInverse;
    // // @ts-ignore
    // const projectionMatrixInverse: Matrix4 = this.camera.projectionMatrixInverse;

    // Render with minimum pixel ratio of 2.
    const pixelRatio = window.devicePixelRatio || 1;

    return (
      // Matrix4 invertedModelViewProjectionMatrix =
      // (_camera.projectionMatrix * _camera.viewMatrix * _modelMatrix).inverted();

      // @ts-ignore
      <Surface width={300} height={300} pixelRatio={pixelRatio}>
        <VoxelShader
          model={this.state.model}
          progress={this.state.progress}
          eye={this.state.eye}
          viewMatrixInverse={this.state.viewMatrixInverse}
          projectionMatrixInverse={this.state.projectionMatrixInverse}
        />
      </Surface>
    );

  }
}

export default ReactAnimationFrame(VoxelViewer);
