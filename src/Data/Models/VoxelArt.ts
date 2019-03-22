import { Vector3, Vector2 } from "three";
import ndarray from "ndarray";

// iOS 12.1 (16B91) Simulator's max is 4096.
export const MAX_TEXTURE_WIDTH = 4096;

export default class VoxelArt {
  pos: Vector3;
  size: Vector3;
  data: Uint8Array;

  constructor (pos: Vector3 = new Vector3(), size: Vector3 = new Vector3()) {
    this.size = size;
    this.pos = pos;
    const volume = size.x * size.y * size.z;
    this.data = new Uint8Array(volume);
  }

  setVoxel(x: number, y: number, z: number, paletteIndex: number) {
    const { size } = this;
    const index = z * size.y * size.x + y * size.x + x;
    this.data[index] = paletteIndex;
  }
}
