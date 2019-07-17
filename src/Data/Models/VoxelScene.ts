import VoxelArt from "./VoxelArt";
import MaterialArray from "../Arrays/MaterialArray";
import ColorArray from "../Arrays/ColorArray";
import Obj from "./Obj";
import { Color } from "three";

export default class VoxelScene {
  models: VoxelArt[];
  colors: ColorArray;
  lightColor: Color;
  groundColor: Color;
  skyColor: Color;
  materials: MaterialArray;
  rootObj: Obj;
  constructor (
    rootObj: Obj = Obj.nullObj,
    models: VoxelArt[] = [],
    materials: MaterialArray = new MaterialArray(),
    colors: ColorArray = new ColorArray(),
    groundColor: Color = new Color(),
    lightColor: Color = new Color(),
    skyColor: Color = new Color()
  ) {
    this.rootObj = rootObj;
    this.models = models;
    this.colors = colors;
    this.materials = materials;
    this.lightColor = lightColor;
    this.groundColor = groundColor;
    this.skyColor = skyColor;
  }
}
