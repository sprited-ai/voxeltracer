import Chunk from "./Chunk";
import MaterialType from "../../../../Enums/MaterialType";

export interface MatlChunkOptions {
  type: MaterialType;
  weight?: number;
  rough?: number;
  spec?: number;
  ior?: number;
  att?: number;
  flux?: number;
  plastic?: boolean;
}

export default class MatlChunk extends Chunk {
  materialId: number;
  options: MatlChunkOptions;
  constructor(materialId: number, options: MatlChunkOptions) {
    super();
    this.materialId = materialId;
    this.options = options;
  }
}
