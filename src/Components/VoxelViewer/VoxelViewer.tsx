import React from "react";
import * as THREE from "three";
import { Surface } from "gl-react-dom";
import VoxelShader from '../VoxelShader/VoxelShader';

export default class VoxelViewer extends React.Component {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;

  constructor(props: Readonly<{}>) {

    super(props);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.01, 1000);
    this.camera.position.z = 5;

  }

  render() {

    const eye: THREE.Vector3 = this.camera.position;
    const matrixWorldInverse: THREE.Matrix4 = this.camera.matrixWorldInverse;
    // @ts-ignore
    const projectionMatrixInverse: THREE.Matrix4 = this.camera.projectionMatrixInverse;

    return (
      // Matrix4 invertedModelViewProjectionMatrix =
      // (_camera.projectionMatrix * _camera.viewMatrix * _modelMatrix).inverted();

      // @ts-ignore
      <Surface width={300} height={300}>
        <VoxelShader
          eye={eye}
          matrixWorldInverse={matrixWorldInverse}
          projectionMatrixInverse={projectionMatrixInverse}
        />
      </Surface>
    );

  }
}
