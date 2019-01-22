import { Vector3, Vector2 } from "three";
import ndarray from "ndarray";

export default class VoxelArt {
  size: Vector3;
  texture: ndarray;
  constructor (size: Vector3) {
    this.size = size;
    const numSlates = Math.ceil(size.y / 4);

    let width = Math.max(Math.max(size.x, size.z), 1);
    while (true) {
      const numCols = Math.floor(width / size.x);
      const numRows = numSlates / numCols;
      if (numCols * size.x <= width && numRows * size.z <= width) {
        break;
      }
      width *= 2;
    }

    const textureData = new Uint8Array(width * width * 4);

    for (let i = 0; i < width * width * 4; ++i) {
      textureData[i] = Math.random() > 0.5 ? 255 : 0;
    }

    this.texture = ndarray(textureData, [width, width, 4]);
  }
}
