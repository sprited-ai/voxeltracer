import Chunk from "./Chunk";

export default class PackChunk extends Chunk {
  numModels: number;
  constructor(numModels: number) {
    super();
    this.numModels = numModels;
  }
}
