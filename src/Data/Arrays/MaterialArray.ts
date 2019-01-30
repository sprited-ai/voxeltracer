import Material from "../Models/Material";
import { Vector4 } from "three";
import ndarray from 'ndarray';
import defaultColorPaletteData from "../defaultColorPaletteData";

export default class MaterialArray {
  private array: Material[];
  private _colorTexture: ndarray;
  constructor() {
    this._colorTexture = ndarray(defaultColorPaletteData, [16, 16, 4]);
    this.array = new Array(256);
    for (let i = 0; i < 256; ++i) {
      // const color = new Vector4(
      //   Math.random(),
      //   Math.random(),
      //   Math.random(),
      //   1
      // );
      this.array[i] = new Material();
    }
  }
  applyAt(index: number, matHash: any) {
    if (matHash.color instanceof Vector4) {
      const mat = this.array[index];
      const { color } = matHash;
      mat.color = color;
      const i = index % 16;
      const j = Math.floor(index / 16);
      // console.log(`Material Array - ${index} => ${i},${j}: ${color.x},${color.y},${color.z},${color.w}`);

      this._colorTexture.set(i, j, 0, color.x);
      this._colorTexture.set(i, j, 1, color.y);
      this._colorTexture.set(i, j, 2, color.z);
      this._colorTexture.set(i, j, 3, color.w);
    }

  }
  get colorTexture() {
    return this._colorTexture;
  }
}
