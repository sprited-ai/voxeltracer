import Chunk from "./Chunk";

export default class RgbaChunk extends Chunk {
  rgbas: Uint8Array;
  constructor(rgbas: Uint8Array) {
    super();
    this.rgbas = rgbas;
  }
}
