import { Vector4, Vector } from "three";
import ndarray from 'ndarray';
import defaultColorPaletteData from "../defaultColorPaletteData";

export default class ColorArray {
  public colorTexture: ndarray;
  constructor() {
    this.colorTexture = ndarray(defaultColorPaletteData, [16, 16, 4]);
  }
  setAt(index: number, color: Vector4) {
    const i = index % 16;
    const j = Math.floor(index / 16);
    this.colorTexture.set(i, j, 0, color.x);
    this.colorTexture.set(i, j, 1, color.y);
    this.colorTexture.set(i, j, 2, color.z);
    this.colorTexture.set(i, j, 3, color.w);
  }
}
