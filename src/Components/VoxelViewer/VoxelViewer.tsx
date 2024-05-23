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
import './VoxelViewer.css';

const MAX_TICK = 1000;
const OrbitControls = require('three-orbit-controls')(THREE);

interface OrbitControls extends THREE.OrbitControls {}

export interface VoxelViewerProps extends React.HTMLAttributes<HTMLDivElement> {
  src: string | File;
  devicePixelRatio?: number;
  onRendered?: () => void;
  onFileChange?: (src: string) => void;
  maxSteps?: number;
}

interface VoxelViewerState {
  src: string | File;
  tick: number;
  took: number;
  startTime: number;
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
  // private src: string | File;
  private containerRef: React.RefObject<HTMLDivElement>;

  constructor(props: VoxelViewerProps) {
    super(props);
    this.containerRef = React.createRef<HTMLDivElement>();
    // this.src = props.src;
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
      src: props.src,
      shapeHashes: [],
      packedTexture: dummyPackedTexture,
      materials: this.scene.materials,
      colors: this.scene.colors,
      tick: 0,
      took: 0,
      startTime: Date.now(),
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
      tick: 0,
      took: 0,
      startTime: Date.now()
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
      took: 0,
      startTime: Date.now(),
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
    this.loader.load(this.state.src).then((scene: VoxelScene) => {
      this.scene = scene;
      this.sceneDidChange();
    });

    // Test other files
    // this.loader.loadUrl('vox/3x3x3.vox');
  }

  componentDidUpdate(prevProps: VoxelViewerProps, prevState: VoxelViewerState) {
    // Reload the scene if the src has changed.
    if (this.props.src !== prevProps.src) {
      this.setState({ src: this.props.src });
    }
    if (this.state.src !== prevState.src) {
      this.loader.load(this.state.src).then((scene: VoxelScene) => {
        this.scene = scene;
        this.sceneDidChange();
      });
    }
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
    this.setState({ tick: 0, took: 0, startTime: Date.now() });
    this.startAnimation();
  }

  onAnimationFrame(time: number) {
    const { tick } = this.state;
    if (this.pauseCount > 0) {
      return;
    }
    this.setState({
      tick: tick + 1,
      took: Date.now() - this.state.startTime
    });
    if (tick === 0) {
      console.log('Render started');
    }
    else if (tick % 10 === 0) {
      console.log(`Rendering: ${tick}/${MAX_TICK}.`);
    }
    if (tick > MAX_TICK || this.props.maxSteps !== undefined && tick > this.props.maxSteps) {
      console.log('Render completed.');
      if (this.props.onRendered) this.props.onRendered();
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

  async takeSnapshot(): Promise<null | Blob> {
    return new Promise((resolve) => {
      console.log("!!takeSnapshot")
      const container = this.containerRef.current;
      if (!container) {
        resolve(null);
        return;
      }
      const canvas = container.querySelector("canvas");
      if (!canvas) {
        resolve(null);
        return;
      }
      function handleBlob(blob: Blob | null) {
        resolve(blob);
      }
      canvas.toBlob(handleBlob, "image/jpeg", 0.95);
    });
  }
  
  render() {
    // const eye: Vector3 = this.camera.position;
    // const viewMatrixInverse: Matrix4 = this.camera.viewMatrixInverse;
    // // @ts-ignore
    // const projectionMatrixInverse: Matrix4 = this.camera.projectionMatrixInverse;

    // Render with minimum pixel ratio of 2.
    const pixelRatio = this.props.devicePixelRatio !== undefined ? this.props.devicePixelRatio : typeof window !== "undefined" && window.devicePixelRatio || 1;
    // Fix it to 2.
    // const pixelRatio = 2;
    const { viewportSize } = this.state;
    const resolution = [
      pixelRatio * viewportSize.x,
      pixelRatio * viewportSize.y
    ];

    const availableVoxelFiles = [
      "vox/3x3x3.vox",
      "vox/8x8x8.vox",
      "vox/bricks.vox",
      "vox/castle.vox",
      "vox/chr_knight.vox",
      "vox/chr_old.vox",
      "vox/chr_rain.vox",
      "vox/chr_sword.vox",
      "vox/doom.vox",
      "vox/emit.vox",
      "vox/ephtracy.vox",
      // "vox/flat_building.vox",
      // "vox/glass.vox",
      // "vox/glossy_apt_v01.vox",
      // "vox/glossy_apt.vox",
      // "vox/hakone_train_v01.vox",
      // "vox/izakaya_with_vending_machine_v02.vox",
      // "vox/izakaya_with_vending_machine_v03.vox",
      // "vox/izakaya_with_vending_machine.vox",
      // "vox/japanese_house_interior.vox",
      "vox/menger.vox",
      "vox/metal.vox",
      "vox/monu1.vox",
      "vox/monu9.vox",
      "vox/monu10.vox",
      "vox/multiple.vox",
      "vox/nature.vox",
      // "vox/pink_mini_store_v02.vox",
      // "vox/pink_mini_store.vox",
      // "vox/pink_multi_purpose_building_v02.vox",
      // "vox/pink_multi_purpose_building.vox",
      // "vox/school_asphalt.vox",
      // "vox/school_main_building_gate.vox",
      // "vox/school_main_part_left_end.vox",
      // "vox/school_main_part_middle_alt.vox",
      // "vox/school_main_part_middle.vox",
      // "vox/school_main_part_right_end.vox",
      // "vox/school_main_part_second_floor_center_piece.vox",
      // "vox/school_main_part_second_floor_left_end.vox",
      // "vox/school_main_part_second_floor_middle_alt.vox",
      // "vox/school_main_part_second_floor_middle.vox",
      // "vox/school_main_part_second_floor_right_end.vox",
      // "vox/school_main_part_top_floor_center_piece.vox",
      // "vox/school_main_part_top_floor_left_end.vox",
      // "vox/school_main_part_top_floor_middle_alt.vox",
      // "vox/school_main_part_top_floor_middle.vox",
      // "vox/school_main_part_top_floor_right_end.vox",
      // "vox/school_podium.vox",
      // "vox/school_shade_part_left.vox",
      // "vox/school_shade_part_middle.vox",
      // "vox/school_shade_part_right.vox",
      // "vox/school_v2_asphalt.vox",
      // "vox/school_v2_gate.vox",
      // "vox/school_v2_left.vox",
      // "vox/school_v2_podium.vox",
      // "vox/school_v2_right.vox",
      // "vox/school_v2_shade_left.vox",
      // "vox/school_v2_shade_more_left.vox",
      // "vox/school_v2_shade_right.vox",
      // "vox/school_v2_slope_left_behind.vox",
      // "vox/school_v2_slope_left.vox",
      // "vox/school_v2_slope_right_behind.vox",
      // "vox/school_v2_slope_right.vox",
      // "vox/school_v03_gate.vox",
      // "vox/school_v03_left.vox",
      // "vox/school_v03_right.vox",
      "vox/shelf.vox",
      "vox/teapot.vox",
      "vox/test_matl.vox",
      // "vox/tiny_apt_v02.vox",
      // "vox/tiny_apt.vox",
      // "vox/untitled.vox",
      // "vox/wall-part-1.vox",
    ]

    const filenameText = this.state.src instanceof File ? this.state.src.name : this.state.src;
    const voxelSize = this.scene && this.scene.models && this.scene.models.length > 0 ? this.scene.models[0].size : undefined;
    const voxelSizeText = voxelSize ? `Voxel Size: ${voxelSize.x}x${voxelSize.y}x${voxelSize.z}` : undefined;
    const artworkText = (
      <select value={filenameText} onChange={(e) => {
        if (this.props.onFileChange) {
          this.props.onFileChange(e.target.value)
        }
      }}>
        {availableVoxelFiles.map((filename, i) => (
          <option key={i} value={filename}>{filename}</option>
        ))}
      </select>
    )
    const renderStatus = this.state.tick >= MAX_TICK ? `Rendering Completed (took ${this.state.took}ms)` : `Rendering (${this.state.tick}/${MAX_TICK})`;
    const resolutionText = `Resolution: ${resolution[0]}x${resolution[1]} (${pixelRatio}x)`;
    const textureSizeText = `Texture Size: ${this.state.packedTexture.shape[0]}x${this.state.packedTexture.shape[1]}x4`;
    const fps = this.state.took > 0 ? this.state.tick / this.state.took * 1000 : 0;
    const fpsText = `FPS: ${fps.toFixed(2)}`;
    const statusLines = [artworkText, voxelSizeText, textureSizeText, resolutionText, renderStatus, fpsText];
    return (
      // Matrix4 invertedModelViewProjectionMatrix =
      // (_camera.projectionMatrix * _camera.viewMatrix * _modelMatrix).inverted();

      // @ts-ignore
      <div class="voxel-viewer" {...this.props}>
        <div className="top-bar">
          VoxelTracer V1.0
        </div>
        <div className="voxel-viewer-surface-container" ref={this.containerRef}>
          <Surface
            width={viewportSize.x}
            height={viewportSize.y}
            pixelRatio={pixelRatio}
            onContextRestored={this.onContextRestored}
            // Needed for snapshoting. There are alternative approaches worth looking at though.
            // Ref: https://webglfundamentals.org/webgl/lessons/webgl-tips.html
            webglContextAttributes={{ preserveDrawingBuffer: true }}
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
        <div className="status-panel">{
          statusLines.map((line, i) => (<div key={i}>{line}</div>))
        }</div>
      </div>
    );

  }
}

// Rest for at least 50ms. This should prevent the webpage 
// from solely consuming all the gpu powers.
export default ReactTimeout<VoxelViewerProps>(ReactAnimationFrame(VoxelViewer));

console.log("VoxelViewer loaded")