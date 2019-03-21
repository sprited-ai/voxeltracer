import { Vector3, Vector2 } from "three";
import ndarray from "ndarray";

// iOS 12.1 (16B91) Simulator's max is 4096.
export const MAX_TEXTURE_WIDTH = 4096;

export default class VoxelArt {
  pos: Vector3;
  size: Vector3;
  texture: ndarray;

  constructor (pos: Vector3 = new Vector3(), size: Vector3 = new Vector3()) {
    this.size = size;
    this.pos = pos;
    // const numSlates = Math.ceil(size.y / 4);

    const volume = size.x * size.y * size.z;

    let width;
    if (size.lengthSq() === 0) {
      width = 0;
    }
    else {
      for (width = 1; width < MAX_TEXTURE_WIDTH; width *= 2) {
        if (volume <= width * width * 4) {
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

  setVoxel(x: number, y: number, z: number, paletteIndex: number) {
    const { size, textureSize } = this;
    const index = z * size.y * size.x + y * size.x + x;
    const i = Math.floor(index / 4) % textureSize.x;
    const j = Math.floor(Math.floor(index / 4) / textureSize.x);
    const k = index % 4;
    this.texture.set(i, j, k, paletteIndex);
  }
}
