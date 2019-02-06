import VoxelScene from "../Models/VoxelScene";
import VoxelArt from "../Models/VoxelArt";
import Material from "../Models/Material";
import MaterialArray from "../Arrays/MaterialArray";
import Context from "./Context";
import { readInt, readStr, uint8 } from "./ByteUtil";
import { Vector3, Matrix4, Vector4 } from "three";

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

/**
 * MagicaVoxel coordinate to OpenGL coordinate system.
 * Rotation x of 90 degrees.
 */
const magicaVoxelToOpenGlCoordinates: Matrix4 = new Matrix4();
magicaVoxelToOpenGlCoordinates.set(
  1, 0, 0, 0,
  0, 0, 1, 0,
  0, -1, 0, 0,
  0, 0, 0, 1
);

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

    if (!(mainChunk instanceof MainChunk)) {
      throw 'Expected main chunk.';
    }

    // Single frame is supported.
    let sizeChunk: SizeChunk | null = null;
    for (let i = 0; i < mainChunk.children.length; ++i) {
      const chunk = mainChunk.children[i];
      if (chunk instanceof PackChunk) {
        // ignore, since we support single frame only.
      }
      else if(chunk instanceof SizeChunk) {
        sizeChunk = chunk;
      }
      else if(chunk instanceof XyziChunk) {
        if (!sizeChunk) {
          throw 'Missing size chunk.';
        }
        const rawSize = new Vector3(sizeChunk.x, sizeChunk.y, sizeChunk.z);
        const size = rawSize.applyMatrix4(magicaVoxelToOpenGlCoordinates);
        size.z = -size.z;

        const pos = new Vector3(
          -Math.floor(size.x / 2),
          0,
          -Math.floor(size.z / 2)
        );
        const model = new VoxelArt(pos, size);
        const { xyzis } = chunk;
        const voxelCount = xyzis.length / 4;
        for (let t = 0; t < voxelCount; ++t) {
          const offset = t * 4;
          // TODO: Z here is gravity direction. Needs to fix this.
          const rawXyz = new Vector3(
            xyzis[offset + 0],
            xyzis[offset + 1],
            xyzis[offset + 2]
          );
          const xyz = rawXyz.applyMatrix4(magicaVoxelToOpenGlCoordinates);
          const i = xyzis[offset + 3];
          model.setVoxel(xyz.x, xyz.y, -xyz.z, i);
        }
        models.push(model);
        sizeChunk = null;
      }
      else if(chunk instanceof RgbaChunk) {
        const { rgbas } = chunk;
        // Map 0-254 to 1-255
        for (let i = 0; i < 255; ++i) {
          const offset = i * 4;
          const r = rgbas[offset + 0];
          const g = rgbas[offset + 1];
          const b = rgbas[offset + 2];
          const a = rgbas[offset + 3];
          const color = new Vector4(r, g, b, a);
          materials.applyAt(i + 1, { color });
        }
      }

    }

    console.log(mainChunk);

    return new VoxelScene(models, materials);
  }

  private decodeChunk(buffer: ArrayBuffer, chunkStart: number) {

    const chunkId = readStr(buffer, chunkStart, 4);
    const numBytesOfChunkContent = readInt(buffer, chunkStart + 4);
    const numBytesOfChildrenChunks = readInt(buffer, chunkStart + 8);
    const contentStart = chunkStart + 12;
    const childrenStart = contentStart + numBytesOfChunkContent;
    const chunkSize = 12 + numBytesOfChunkContent + numBytesOfChildrenChunks;
    let chunk: Chunk;

    // console.log(`Decoding ${chunkId} chunk at ${chunkStart} byte offset (size: ${chunkSize}bytes)`);
    // console.log(`Decoding ${chunkId}`);

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
      // console.log(`Skipping unsupported chunk type "${chunkId}"`);
      chunk = new UnsupportedChunk();
    }

    chunk.size = chunkSize;

    return chunk;
  }

}
