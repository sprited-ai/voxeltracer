import Material from "../Materials/Material";
import { Vector4 } from "three";
import ndarray from 'ndarray';
import defaultColorPaletteData from "../defaultColorPaletteData";

export default class MaterialArray {
  private array: Material[];
  constructor() {
    this.array = new Array(256);
  }
  setAt(index: number, material: Material) {
    this.array[index] = material;
  }
}
