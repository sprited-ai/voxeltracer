export default interface ShapeHash {
  modelIndex: number;
  /** column-major 3x3 rotation (three.js Matrix3.toArray()) */
  rotation: number[];
  translation: number[];
  /** model grid dimensions */
  size: number[];
  /** pivot offset of the model */
  pos: number[];
  /** placement of this model's voxels inside the 3D atlas */
  atlasOffset: [number, number, number];
}
