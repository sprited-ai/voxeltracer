import React from "react";
import * as THREE from 'three';
import { PerspectiveCamera, Vector3, Vector2, Color } from "three";
import { Surface } from "gl-react-dom";
import VoxelShader from '../VoxelShader/VoxelShader';
import ReactAnimationFrame from 'react-animation-frame';
import MaterialArray from "../../Data/Arrays/MaterialArray";
import VoxelScene from "../../Data/Models/VoxelScene";
import Loader from "../../Data/Loaders/Loader";
import ReactTimeout from 'react-timeout'
import ColorArray from "../../Data/Arrays/ColorArray";
import ScenePacker from "../../Data/Packers/ScenePacker";
import ndarray from "ndarray";
import ShapeHash from "../../Data/Types/ShapeHash";

const MAX_TICK = 1024;
const OrbitControls = require('three-orbit-controls')(THREE);

interface OrbitControls extends THREE.OrbitControls {}

interface VoxelViewerProps extends React.HTMLAttributes<HTMLDivElement> {
  src: string | File
}

interface VoxelViewerState {
  tick: number;
  eye: number[];
  lightDir: Vector3;
  lightColor: Color;
  skyColor: Color;
  groundColor: Color;
  viewMatrixInverse: Float32Array;
  projectionMatrixInverse: Float32Array;
  packedTexture: ndarray;
  shapeHashes: ShapeHash[];
  materials: MaterialArray;
  colors: ColorArray;
  viewportSize: Vector2;
}

const dummyPackedTexture: ndarray = ndarray(new Uint8Array(4), [1, 1, 4]);

class VoxelViewer extends React.Component<VoxelViewerProps, VoxelViewerState> {
  // scene: Scene;
  private scene: VoxelScene;
  private camera: PerspectiveCamera;
  private orbitControls?: OrbitControls;
  private loader: Loader;
  private pauseCount: number = 0;
  private src: string | File;
  private containerRef: React.RefObject<HTMLDivElement>;

  constructor(props: VoxelViewerProps) {
    super(props);
    this.containerRef = React.createRef<HTMLDivElement>();
    this.src = props.src;
    this.loader = new Loader();
    this.scene = new VoxelScene();
    // Initial dummy value.
    const viewportSize = new Vector2(512, 512);
    this.camera = new PerspectiveCamera(
      60,
      (viewportSize.y > 0 ? viewportSize.x / viewportSize.y : 1), 
      0.01, 
      1000
    );
    this.camera.position.set(0, 50, 100);
    this.camera.lookAt(new Vector3(0, 30, 0));
    this.camera.updateProjectionMatrix();
    const lightDir = new Vector3(-1.1, 1.9, 1.7);
    lightDir.normalize();
    this.state = {
      shapeHashes: [],
      packedTexture: dummyPackedTexture,
      materials: this.scene.materials,
      colors: this.scene.colors,
      tick: 0,
      viewportSize,
      lightDir: lightDir,
      lightColor: new Color(),
      skyColor: new Color(),
      groundColor: new Color(),
      eye: this.camera.position.toArray(),
      viewMatrixInverse: this.camera.matrixWorld.elements,
      //@ts-ignore
      projectionMatrixInverse: this.camera.projectionMatrixInverse.elements
    };
  }

  sceneDidChange(): void {
    const scenePacker = new ScenePacker();
    const [shapeHashes, packedTexture] = scenePacker.pack(this.scene);
    this.setState({
      shapeHashes,
      packedTexture,
      materials: this.scene.materials,
      colors: this.scene.colors,
      groundColor: this.scene.groundColor,
      skyColor: this.scene.skyColor,
      lightColor: this.scene.lightColor,
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
    // this.camera.lookAt(new Vector3(0, 0, 0));
    // this.camera.lookAt(new Vector3(0, 25, 0));
    if (this.orbitControls) {
      this.camera.lookAt(this.orbitControls.target);
    }

    this.camera.updateProjectionMatrix();

    this.setState({
      tick: 0,
      eye: this.camera.position.toArray(),
      viewMatrixInverse: this.camera.matrixWorld.elements,
      //@ts-ignore
      projectionMatrixInverse: this.camera.projectionMatrixInverse.elements
    });
  }

  componentDidMount() {
    const containerEl = this.containerRef.current!;
    const viewportSize = new Vector2(containerEl.clientWidth, containerEl.clientHeight);

    this.onWindowResize();
    
    window.addEventListener('resize', this.onWindowResize);

    this.setState({
      viewportSize,
      eye: this.camera.position.toArray(),
      viewMatrixInverse: this.camera.matrixWorld.elements,
      //@ts-ignore
      projectionMatrixInverse: this.camera.projectionMatrixInverse.elements
    });

    console.log("new OrbitControls", containerEl)
    const orbitControls: OrbitControls = this.orbitControls = new OrbitControls(this.camera, containerEl);
    orbitControls.target = new Vector3(0, 30, 0);
    orbitControls.addEventListener('change', this.didOrbit);

    // Load model.
    this.loader.load(this.src).then((scene: VoxelScene) => {
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
    const containerEl = this.containerRef.current!;
    const viewportSize = new Vector2(containerEl.clientWidth, containerEl.clientHeight);


    if (viewportSize.x > 0 && viewportSize.y > 0) {
      this.camera.aspect = viewportSize.x / viewportSize.y;
    }
    else {
      this.camera.aspect = 1.0;
    }

    this.setState({ viewportSize });
    this.cameraDidUpdate();
  }

  render() {
    // const eye: Vector3 = this.camera.position;
    // const viewMatrixInverse: Matrix4 = this.camera.viewMatrixInverse;
    // // @ts-ignore
    // const projectionMatrixInverse: Matrix4 = this.camera.projectionMatrixInverse;

    // Render with minimum pixel ratio of 2.
    const pixelRatio = typeof window !== "undefined" && window.devicePixelRatio || 1;
    const { viewportSize } = this.state;
    const resolution = [
      pixelRatio * viewportSize.x,
      pixelRatio * viewportSize.y
    ];
    return (
      // Matrix4 invertedModelViewProjectionMatrix =
      // (_camera.projectionMatrix * _camera.viewMatrix * _modelMatrix).inverted();

      // @ts-ignore
      <div ref={this.containerRef} {...this.props}>
        <Surface
          width={viewportSize.x}
          height={viewportSize.y}
          pixelRatio={pixelRatio}
          onContextRestored={this.onContextRestored}
          // webglContextAttributes={{ preserveDrawingBuffer: true }}
        >
          <VoxelShader
            shapeHashes={this.state.shapeHashes}
            packedTexture={this.state.packedTexture}
            colors={this.state.colors}
            materials={this.state.materials}
            tick={this.state.tick}
            maxTick={MAX_TICK}
            resolution={resolution}
            eye={this.state.eye}
            lightDir={this.state.lightDir}
            lightColor={this.state.lightColor}
            groundColor={this.state.groundColor}
            skyColor={this.state.skyColor}
            viewMatrixInverse={this.state.viewMatrixInverse}
            projectionMatrixInverse={this.state.projectionMatrixInverse}
          />
        </Surface>
      </div>
    );

  }
}

// Rest for at least 50ms. This should prevent the webpage 
// from solely consuming all the gpu powers.
export default ReactTimeout<VoxelViewerProps>(ReactAnimationFrame(VoxelViewer, 80));
