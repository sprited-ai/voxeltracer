import VoxelArt from "./VoxelArt";
import MaterialArray from "../Arrays/MaterialArray";

export default class VoxelScene {
  models: VoxelArt[];
  materials: MaterialArray;
  constructor (models: VoxelArt[] = [], materials: MaterialArray = new MaterialArray()) {
    this.models = models;
    this.materials = materials;
  }
}
