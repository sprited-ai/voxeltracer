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

    // // randomize it for now.
    // for (let i = 0; i < width * width * 4; ++i) {
    //   const randomIndex = Math.floor(Math.random() * 255);
    //   textureData[i] = Math.random() > 0.5 ? randomIndex  : 0;
    // }

    this.texture = ndarray(textureData, [width, width, 4]);
  }

  get textureSize(): Vector2 {
    return new Vector2(this.texture.shape[0], this.texture.shape[1]);
  }

  setVoxel(x: number, y: number, z: number, i: number) {
    const { size, textureSize } = this;
    const slateIndex = Math.floor(y / 4);
    const sliceIndex = y % 4;
    const numCols = Math.floor(textureSize.x / size.x);
    const col = slateIndex % numCols;
    const row = Math.floor(slateIndex / numCols);
    const locationX = col * size.x + x;
    const locationY = row * size.z + z;
    this.texture.set(locationX, locationY, sliceIndex, i);
  }
}
