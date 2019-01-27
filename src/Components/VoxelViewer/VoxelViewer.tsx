import React from "react";
import * as THREE from 'three';
import { PerspectiveCamera, Vector3 } from "three";
import { Surface } from "gl-react-dom";
import VoxelShader from '../VoxelShader/VoxelShader';
import ReactAnimationFrame from 'react-animation-frame';
import VoxelArt from "../../Data/Models/VoxelArt";
import MaterialArray from "../../Data/Arrays/MaterialArray";
import VoxelScene from "../../Data/Models/VoxelScene";
import Loader from "../../Data/Loaders/Loader";

const OrbitControls = require('three-orbit-controls')(THREE);

interface OrbitControls extends THREE.OrbitControls {}

interface VoxelViewerProps { }

interface VoxelViewerState {
  progress: number;
  eye: number[];
  viewMatrixInverse: Float32Array;
  projectionMatrixInverse: Float32Array;
  models: VoxelArt[];
  materials: MaterialArray;
}

class VoxelViewer extends React.Component<VoxelViewerProps, VoxelViewerState> {
  // scene: Scene;
  scene: VoxelScene;
  camera: PerspectiveCamera;
  orbitControls?: OrbitControls;
  loader: Loader;

  constructor(props: VoxelViewerProps) {
    super(props);
    // this.scene = new Scene();
    this.camera = new PerspectiveCamera(60, 1, 0.01, 1000);
    this.camera.position.set(0, 0, -100);
    this.camera.lookAt(new Vector3(0, 0, 0));

    this.loader = new Loader();
    this.scene = new VoxelScene();
    // // Sample model.
    // models.push(
    //   new VoxelArt(
    //     new Vector3(0, -2, -2),
    //     new Vector3(4, 4, 4)
    //   )
    // );
    // models.push(
    //   new VoxelArt(
    //     new Vector3(-4, -2, -2),
    //     new Vector3(4, 4, 4)
    //   )
    // );

    this.state = {
      models: this.scene.models,
      materials: this.scene.materials,
      progress: 0,
      eye: this.camera.position.toArray(),
      viewMatrixInverse: this.camera.matrixWorld.elements,
      //@ts-ignore
      projectionMatrixInverse: this.camera.projectionMatrixInverse.elements
    };
  }

  sceneDidChange(): void {
    this.setState({
      models: this.scene.models,
      materials: this.scene.materials
    });
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

    // Load deafult model.
    this.loader.loadUrl('vox/pink_mini_store.vox').then((scene: VoxelScene) => {
      this.scene = scene;
      this.sceneDidChange();
    });

    // Test other files
    // this.loader.loadUrl('vox/3x3x3.vox');
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
    const pixelRatio = Math.max(window.devicePixelRatio || 1, 2);

    return (
      // Matrix4 invertedModelViewProjectionMatrix =
      // (_camera.projectionMatrix * _camera.viewMatrix * _modelMatrix).inverted();

      // @ts-ignore
      <Surface width={300} height={300} pixelRatio={pixelRatio}>
        <VoxelShader
          models={this.state.models}
          materials={this.state.materials}
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
