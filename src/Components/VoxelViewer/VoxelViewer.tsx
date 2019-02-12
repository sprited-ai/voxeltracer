import React from "react";
import * as THREE from 'three';
import { PerspectiveCamera, Vector3, Vector2 } from "three";
import { Surface } from "gl-react-dom";
import VoxelShader from '../VoxelShader/VoxelShader';
import ReactAnimationFrame from 'react-animation-frame';
import VoxelArt from "../../Data/Models/VoxelArt";
import MaterialArray from "../../Data/Arrays/MaterialArray";
import VoxelScene from "../../Data/Models/VoxelScene";
import Loader from "../../Data/Loaders/Loader";
import ReactTimeout from 'react-timeout'
import ColorArray from "../../Data/Arrays/ColorArray";

const MAX_TICK = 1024;
const OrbitControls = require('three-orbit-controls')(THREE);

interface OrbitControls extends THREE.OrbitControls {}

interface VoxelViewerProps { }

interface VoxelViewerState {
  tick: number;
  eye: number[];
  lightDir: Vector3;
  viewMatrixInverse: Float32Array;
  projectionMatrixInverse: Float32Array;
  models: VoxelArt[];
  materials: MaterialArray;
  colors: ColorArray;
  viewportSize: Vector2;
}

class VoxelViewer extends React.Component<VoxelViewerProps, VoxelViewerState> {
  // scene: Scene;
  private scene: VoxelScene;
  private camera: PerspectiveCamera;
  private orbitControls?: OrbitControls;
  private loader: Loader;
  private pauseCount: number = 0;

  constructor(props: VoxelViewerProps) {
    super(props);
    // this.scene = new Scene();
    this.camera = new PerspectiveCamera(60, 1, 0.01, 1000);
    this.camera.position.set(0, 60, -100);
    this.camera.lookAt(new Vector3(0, 25, 0));

    this.loader = new Loader();
    this.scene = new VoxelScene();

    window.addEventListener('resize', this.onWindowResize);
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
    const lightDir = new Vector3(-1.1, 1.9, -1.7);
    lightDir.normalize();

    const viewportSize = new Vector2(512, 512);
    this.state = {
      models: this.scene.models,
      materials: this.scene.materials,
      colors: this.scene.colors,
      tick: 0,
      viewportSize,
      lightDir: lightDir,
      eye: this.camera.position.toArray(),
      viewMatrixInverse: this.camera.matrixWorld.elements,
      //@ts-ignore
      projectionMatrixInverse: this.camera.projectionMatrixInverse.elements
    };
  }

  sceneDidChange(): void {
    this.setState({
      models: this.scene.models,
      materials: this.scene.materials,
      colors: this.scene.colors,
      tick: 0
    });
    this.restartAnimation();
    this.pauseAnimation(200);
  }

  startAnimation(): void {
    (this.props as any).startAnimation();
  }

  endAnimation(): void {
    (this.props as any).endAnimation();
  }

  pauseAnimation(ms: number) {
    this.pauseCount++;
    (this.props as any).setTimeout(() => {
      this.pauseCount--;
      if (this.pauseCount <= 0) {
        this.pauseCount = 0;
        this.startAnimation();
      }
    }, ms)
  }

  didOrbit = (event: Event) => {
    this.cameraDidUpdate();
    this.pauseAnimation(100);
  }

  cameraDidUpdate() {
    // TODO: Figure out why this is needed.
    // Ideally, this should have been handled by the Orbit controlls.
    this.camera.lookAt(new Vector3(0, 0, 0));
    // this.camera.lookAt(new Vector3(0, 25, 0));

    this.setState({
      tick: 0,
      eye: this.camera.position.toArray(),
      viewMatrixInverse: this.camera.matrixWorld.elements,
      //@ts-ignore
      projectionMatrixInverse: this.camera.projectionMatrixInverse.elements
    });
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

  restartAnimation() {
    this.endAnimation();
    this.setState({ tick: 0 });
    this.startAnimation();
  }

  onAnimationFrame(time: number) {
    const { tick } = this.state;
    if (this.pauseCount > 0) {
      return;
    }
    this.setState({
      tick: tick + 1
    });
    if (tick === 0) {
      console.log('Render started');
    }
    else if (tick % 10 === 0) {
      console.log(`Rendering: ${tick}/${MAX_TICK}.`);
    }
    if (tick > MAX_TICK) {
      console.log('Render completed.');
      this.endAnimation();
    }
  }

  onContextLost = () => {
    console.log('context lost');
    this.endAnimation();
  }

  onContextRestored = () => {
    console.log('context restored');
    this.restartAnimation();
  }

  onWindowResize = () => {
    console.log('window resize');
    this.restartAnimation();
  }

  render() {
    // const eye: Vector3 = this.camera.position;
    // const viewMatrixInverse: Matrix4 = this.camera.viewMatrixInverse;
    // // @ts-ignore
    // const projectionMatrixInverse: Matrix4 = this.camera.projectionMatrixInverse;

    // Render with minimum pixel ratio of 2.
    const pixelRatio = window.devicePixelRatio || 1;
    const { viewportSize } = this.state;
    const resolution = [
      pixelRatio * viewportSize.x,
      pixelRatio * viewportSize.y
    ];
    return (
      // Matrix4 invertedModelViewProjectionMatrix =
      // (_camera.projectionMatrix * _camera.viewMatrix * _modelMatrix).inverted();

      // @ts-ignore
      <Surface
        width={viewportSize.x}
        height={viewportSize.y}
        pixelRatio={pixelRatio}
        onContextRestored={this.onContextRestored}
        // webglContextAttributes={{ preserveDrawingBuffer: true }}
      >
        <VoxelShader
          models={this.state.models}
          colors={this.state.colors}
          materials={this.state.materials}
          tick={this.state.tick}
          maxTick={MAX_TICK}
          resolution={resolution}
          eye={this.state.eye}
          lightDir={this.state.lightDir}
          viewMatrixInverse={this.state.viewMatrixInverse}
          projectionMatrixInverse={this.state.projectionMatrixInverse}
        />
      </Surface>
    );

  }
}

export default ReactTimeout(ReactAnimationFrame(VoxelViewer));
