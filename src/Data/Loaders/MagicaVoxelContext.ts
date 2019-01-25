import VoxelScene from "../Models/VoxelScene";
import VoxelArt from "../Models/VoxelArt";
import Material from "../Models/Material";
import MaterialArray from "../Arrays/MaterialArray";
import Context from "./Context";
import { readFloat, readInt, readStr, readUint, uint8, uint32 } from "./ByteUtil";
import MaterialType from "../../Enums/MaterialType";

class Chunk {
  size: number = 0;
}

class MainChunk extends Chunk {
  children: Chunk[];
  constructor(children: Chunk[]) {
    super();
    this.children = children;
  }
}

class PackChunk extends Chunk {
  numModels: number;
  constructor(numModels: number) {
    super();
    this.numModels = numModels;
  }
}

class SizeChunk extends Chunk {
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

class XyziChunk extends Chunk {
  xyzis: Uint8Array;
  constructor(xyzis: Uint8Array) {
    super();
    this.xyzis = xyzis;
  }
}

class RgbaChunk extends Chunk {
  rgbas: Uint8Array;
  constructor(rgbas: Uint8Array) {
    super();
    this.rgbas = rgbas;
  }
}

class MattChunk extends Chunk {
  // Not implemented yet
}

class UnsupportedChunk extends Chunk {
  // Not implemented yet
}

export default class MagicaVoxelContext extends Context {

  public decode(buffer: ArrayBuffer): VoxelScene {
    // const bytes = new Uint8Array(buffer);
    console.log(readStr(buffer, 0, 4));

    if (readStr(buffer, 0, 4) !== 'VOX ') {
      throw 'Not a MagicaVoxel file.';
    }

    const version = readInt(buffer, 4);

    console.log(`MagicaVoxel File Format Version ${version}`);
    if (version === 150) {
      return this.decode150(buffer);
    }
    else {
      throw 'Version is not supported';
    }
  }

  private decode150(buffer: ArrayBuffer): VoxelScene {
    const models: VoxelArt[] = [];
    const materials: MaterialArray = new MaterialArray();

    const mainChunk = this.decodeChunk(buffer, 8);

    // @TODO construct models.
    debugger;

    console.log(mainChunk);

    return new VoxelScene(models, materials);
  }

  private decodeChunk(buffer: ArrayBuffer, chunkStart: number) {

    const chunkId = readStr(buffer, chunkStart, 4);
    const numBytesOfChunkContent = readInt(buffer, chunkStart + 4);
    const numBytesOfChildrenChunks = readInt(buffer, chunkStart + 8);
    const contentStart = chunkStart + 12;
    const childrenStart = contentStart + numBytesOfChunkContent;
    var chunkSize = 12 + numBytesOfChunkContent + numBytesOfChildrenChunks;

    let chunk: Chunk;

    if (chunkId === 'MAIN') {
      const children: Chunk[] = [];
      let numBytesOfChildrenChunksRead = 0;
      while (numBytesOfChildrenChunksRead < numBytesOfChildrenChunks) {
        const childChunk = this.decodeChunk(buffer,
          childrenStart + numBytesOfChildrenChunksRead
        );
        children.push(childChunk);
        numBytesOfChildrenChunksRead += childChunk.size;
      }
      chunk = new MainChunk(children);

    }
    else if (chunkId === 'PACK') {
      chunk = new PackChunk(readInt(buffer, contentStart));
    }
    else if (chunkId === 'SIZE') {
      chunk = new SizeChunk(
        readInt(buffer, contentStart),
        readInt(buffer, contentStart + 4),
        readInt(buffer, contentStart + 8)
      );
    }
    else if (chunkId === 'XYZI') {
      const numVoxels = readInt(buffer, contentStart);
      const xyzis = uint8(buffer, contentStart + 4, 4 * numVoxels);
      chunk = new XyziChunk(xyzis);
    }
    else if (chunkId === 'RGBA') {
      const rgbas = uint8(buffer, contentStart, 256 * 4);
      chunk = new RgbaChunk(rgbas);
    }
    else if (chunkId === 'MATT') {
      chunk = new MattChunk();
    }
    else {
      console.warn(`Unsupported chunk type "${chunkId}"`);
      chunk = new UnsupportedChunk();
    }

    chunk.size = chunkSize;

    return chunk;
  }

}
