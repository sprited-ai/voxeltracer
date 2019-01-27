import VoxelScene from "../Models/VoxelScene";

export default abstract class Context {
  abstract decode(data: ArrayBuffer): VoxelScene
}
