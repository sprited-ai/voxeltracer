import Chunk from "./Chunk";

export default class MainChunk extends Chunk {
  children: Chunk[];
  constructor(children: Chunk[]) {
    super();
    this.children = children;
  }
}
