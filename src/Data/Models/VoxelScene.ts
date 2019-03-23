import VoxelArt from "./VoxelArt";
import MaterialArray from "../Arrays/MaterialArray";
import ColorArray from "../Arrays/ColorArray";
import Obj from "./Obj";

export default class VoxelScene {
  models: VoxelArt[];
  colors: ColorArray;
  materials: MaterialArray;
  rootObj: Obj;
  constructor (
    rootObj: Obj = Obj.nullObj,
    models: VoxelArt[] = [],
    colors: ColorArray = new ColorArray(),
    materials: MaterialArray = new MaterialArray()
  ) {
    this.rootObj = rootObj;
    this.models = models;
    this.colors = colors;
    this.materials = materials;
  }
}
