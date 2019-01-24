import { Vector3, Vector2 } from "three";
import ndarray from "ndarray";

export const MAX_TEXTURE_WIDTH = 8192;

export default class VoxelArt {
  pos: Vector3;
  size: Vector3;
  texture: ndarray;
  constructor (pos: Vector3 = new Vector3(), size: Vector3 = new Vector3()) {
    this.size = size;
    this.pos = pos;
    const numSlates = Math.ceil(size.y / 4);

    let width;
    if (size.lengthSq() === 0) {
      width = 0;
    }
    else {
      for (width = 1; width < MAX_TEXTURE_WIDTH; width *= 2) {
        const numCols = Math.floor(width / size.x);
        const numRows = numSlates / numCols;
        if (numCols * size.x <= width && numRows * size.z <= width) {
          break;
        }
      }
    }

    const textureData = new Uint8Array(width * width * 4);

    for (let i = 0; i < width * width * 4; ++i) {
      textureData[i] = Math.random() > 0.5 ? 255 : 0;
    }

    this.texture = ndarray(textureData, [width, width, 4]);
  }
  get textureSize(): Vector2 {
    return new Vector2(this.texture.shape[0], this.texture.shape[1]);
  }
}
