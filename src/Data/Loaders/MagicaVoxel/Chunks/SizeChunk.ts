import Chunk from "./Chunk";

export default class SizeChunk extends Chunk {
  x: number = 0;
  y: number = 0;
  z: number = 0;
  constructor(x: number, y: number, z: number) {
    super();
    this.x = x;
    this.y = y;
    this.z = z;
  }
}
