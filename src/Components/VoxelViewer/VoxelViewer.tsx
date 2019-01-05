import React from "react";
import * as THREE from 'three';
import { Scene, PerspectiveCamera, Vector3, Matrix4 } from "three";
import { Surface } from "gl-react-dom";
import VoxelShader from '../VoxelShader/VoxelShader';

const OrbitControls = require('three-orbit-controls')(THREE);

interface OrbitControls extends THREE.OrbitControls {}

interface VoxelViewerProps { }

interface VoxelViewerStateProps {
  eye: number[],
  matrixWorldInverse: Float32Array,
  projectionMatrixInverse: Float32Array
}

export default class VoxelViewer extends React.Component<VoxelViewerProps, VoxelViewerStateProps> {
  scene: Scene;
  camera: PerspectiveCamera;
  orbitControls?: OrbitControls;

  constructor(props: VoxelViewerProps) {
    super(props);
    this.scene = new Scene();
    this.camera = new PerspectiveCamera(75, 1, 0.01, 1000);
    this.camera.position.set(0, 0, 5);
    this.camera.lookAt(new Vector3(0, 0, 0));
    this.state = {
      eye: this.camera.position.toArray(),
      matrixWorldInverse: this.camera.matrixWorldInverse.elements,
      //@ts-ignore
      projectionMatrixInverse: this.camera.projectionMatrixInverse.elements
    };
  }

  didOrbit = (event: Event) => {
    this.cameraDidUpdate();
  }

  cameraDidUpdate() {
    this.setState({
      eye: this.camera.position.toArray(),
      matrixWorldInverse: this.camera.matrixWorldInverse.elements,
      //@ts-ignore
      projectionMatrixInverse: this.camera.projectionMatrixInverse.elements
    });
  }

  componentDidMount() {
    const orbitControls = this.orbitControls = new OrbitControls( this.camera );
    orbitControls.addEventListener('change', this.didOrbit);
  }

  componentWillUnmount() {

    if (this.orbitControls) {
      this.orbitControls.removeEventListener('change', this.didOrbit);
      this.orbitControls.dispose();
      delete this.orbitControls;
    }

  }

  render() {
    // const eye: Vector3 = this.camera.position;
    // const matrixWorldInverse: Matrix4 = this.camera.matrixWorldInverse;
    // // @ts-ignore
    // const projectionMatrixInverse: Matrix4 = this.camera.projectionMatrixInverse;

    return (
      // Matrix4 invertedModelViewProjectionMatrix =
      // (_camera.projectionMatrix * _camera.viewMatrix * _modelMatrix).inverted();

      // @ts-ignore
      <Surface width={300} height={300}>
        <VoxelShader
          eye={this.state.eye}
          matrixWorldInverse={this.state.matrixWorldInverse}
          projectionMatrixInverse={this.state.projectionMatrixInverse}
        />
      </Surface>
    );

  }
}

