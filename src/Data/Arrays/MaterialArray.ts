import Material from "../Models/Material";
import { Vector4 } from "three";
import ndarray from 'ndarray';
import defaultColorPaletteTexture from "../defaultColorPaletteTexture";

export default class MaterialArray {
  private array: Material[];
  private colorTextureData?: Uint8Array;
  constructor() {
    this.array = new Array(256);
    for (let i = 0; i < 256; ++i) {
      const color = new Vector4(
        Math.random(),
        Math.random(),
        Math.random(),
        1
      );
      this.array[i] = new Material(color);
    }
  }
  get colorTexture() {
    if (this.colorTextureData) {
      return ndarray(this.colorTextureData, [16, 16, 4]);
    }
    return defaultColorPaletteTexture;
  }
}
