import Chunk from "./Chunk";

export default class XyziChunk extends Chunk {
  xyzis: Uint8Array;
  constructor(xyzis: Uint8Array) {
    super();
    this.xyzis = xyzis;
  }
}
