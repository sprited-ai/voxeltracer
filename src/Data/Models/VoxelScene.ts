import VoxelArt from "./VoxelArt";
import MaterialArray from "../Arrays/MaterialArray";
import ColorArray from "../Arrays/ColorArray";
import ndarray from "ndarray";
import { Vector3 } from "three";

export default class VoxelScene {
  models: VoxelArt[];
  colors: ColorArray;
  materials: MaterialArray;
  constructor (
    models: VoxelArt[] = [],
    colors: ColorArray = new ColorArray(),
    materials: MaterialArray = new MaterialArray()
  ) {
    this.models = models;
    this.colors = colors;
    this.materials = materials;
  }
}
