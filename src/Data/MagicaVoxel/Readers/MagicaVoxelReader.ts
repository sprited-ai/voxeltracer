import Reader from "../../Readers/Reader";
import { Matrix4 } from "three";
import Chunk from "../Chunks/Chunk";
import MainChunk from "../Chunks/MainChunk";
import PackChunk from "../Chunks/PackChunk";
import SizeChunk from "../Chunks/SizeChunk";
import XyziChunk from "../Chunks/XyziChunk";
import RgbaChunk from "../Chunks/RgbaChunk";
import MattChunk from "../Chunks/MattChunk";
import MatlChunk, { MatlChunkOptions } from "../Chunks/MatlChunk";
import NtrnChunk from "../Chunks/NtrnChunk";
import UnsupportedChunk from "../Chunks/UnsupportedChunk";
import MagicaVoxelData from "../MagicaVoxelData";
import MaterialType from "../../../Enums/MaterialType";
import NgrpChunk from "../Chunks/NgrpChunk";
import NshpChunk from "../Chunks/NshpChunk";
import LayrChunk from "../Chunks/LayrChunk";

type Dict = {
  [key: string]: string;
}

class ChunkHeader {
  chunkId: string;
  numBytesOfChunkContent: number;
  numBytesOfChildrenChunks: number;
  constructor (chunkId: string, numBytesOfChunkContent: number, numBytesOfChildrenChunks: number) {
    this.chunkId = chunkId;
    this.numBytesOfChunkContent = numBytesOfChunkContent;
    this.numBytesOfChildrenChunks = numBytesOfChildrenChunks;
  }
}

type MagicaVoxelHeader = {
  version: number;
}

export default class MagicaVoxelReader extends Reader {

  readFile(): MagicaVoxelData {
    const { version } = this.readHeader();
    if (version !== 150) {
      throw 'Version is not supported';
    }
    const mainChunk = this.readMainChunk();
    return new MagicaVoxelData(mainChunk);
  }

  readHeader(): MagicaVoxelHeader {
    if (this.readStr(4) !== 'VOX ') {
      throw 'Not a MagicaVoxel file.';
    }
    const version = this.readInt();
    return { version };
  }

  readDict(): Dict {
    const total: number = this.readInt();
    const result: Dict = {};
    for (let i = 0; i < total; ++i) {
      const key = this.readStr(this.readInt());
      const value = this.readStr(this.readInt());
      result[key] = value;
    }
    return result;
  }

  peekChunkId(): string {
    return this.peekStr(4);
  }

  readChunkHeader(): ChunkHeader {
    const result = new ChunkHeader(
      this.readStr(4),
      this.readInt(),
      this.readInt()
    );
    // console.log(result);
    return result;
  }

  readChunk(): Chunk {
    const chunkId = this.peekChunkId();
    switch (chunkId) {
      case 'MAIN':
        return this.readMainChunk();
      case 'PACK':
        return this.readPackChunk();
      case 'SIZE':
        return this.readSizeChunk();
      case 'XYZI':
        return this.readXyziChunk();
      case 'RGBA':
        return this.readRgbaChunk();
      case 'MATT':
        return this.readMattChunk();
      case 'MATL':
        return this.readMatlChunk();
      case 'nTRN':
        return this.readNtrnChunk();
      case 'nGRP':
        return this.readNgrpChunk();
      case 'nSHP':
        return this.readNshpChunk();
      case 'LAYR':
        return this.readLayrChunk();
      default:
        return this.readUnsupportedChunk();
    }
  }

  readMainChunk(): MainChunk {
    const {
      numBytesOfChunkContent,
      numBytesOfChildrenChunks
    } = this.readChunkHeader();
    this.skip(numBytesOfChunkContent);
    const children: Chunk[] = [];
    let byteEnd = this.byteOffset + numBytesOfChildrenChunks;
    while (this.byteOffset < byteEnd) {
      children.push(this.readChunk());
    }
    return new MainChunk(children);
  }

  readPackChunk(): PackChunk {
    this.readChunkHeader();
    return new PackChunk(this.readInt());
  }

  readSizeChunk(): SizeChunk {
    this.readChunkHeader();
    return new SizeChunk(
      this.readInt(),
      this.readInt(),
      this.readInt()
    );
  }

  readXyziChunk(): XyziChunk {
    this.readChunkHeader();
    const numVoxels = this.readInt();
    const xyzis: Uint8Array = this.readBytes(4 * numVoxels);
    return new XyziChunk(xyzis);
  }

  readRgbaChunk(): RgbaChunk {
    this.readChunkHeader();
    const rgbas: Uint8Array = this.readBytes(256 * 4);
    return new RgbaChunk(rgbas);
  }

  readMattChunk(): MattChunk {
    this.readChunkHeader();
    // TODO: New version uses MATL. We should still support old file formats.
    return new MattChunk();
  }

  readMatlChunk(): MatlChunk {
    this.readChunkHeader();
    const materialId = this.readInt();
    const dict = this.readDict();
    
    console.log(dict);

    // Type
    let type;
    switch(dict._type) {
      case '_diffuse': type = MaterialType.DIFFUSE; break;
      case '_metal': type = MaterialType.METAL; break;
      case '_glass': type = MaterialType.GLASS; break;
      case '_emit': type = MaterialType.EMISSIVE; break;
      default: type = MaterialType.DIFFUSE; break;
    }

    const options: MatlChunkOptions = { type };

    if (dict._weight) {
      // Magicavoxel used to use this for all materials except diffuse
      // But no longer the case.
      options.weight = parseFloat(dict._weight as string);
    } else if (type === MaterialType.GLASS && dict._alpha) {
      // Glass material now uses _alpha instead of _weight
      options.weight = parseFloat(dict._alpha as string);
    } else if (type === MaterialType.METAL && dict._metal) {
      // Metal material now uses _metal instead of _weight
      options.weight = parseFloat(dict._metal as string);
    } else if (type === MaterialType.EMISSIVE && dict._emit) {
      // Emissive material now uses _emit instead of _weight
      options.weight = parseFloat(dict._emit as string);
    }

    if (dict._rough) {
      options.rough = parseFloat(dict._rough as string);
    }
    if (dict._spec) {
      options.spec = parseFloat(dict._spec as string);
    }
    if (dict._ior) {
      options.ior = parseFloat(dict._ior as string);
    }
    if (dict._att) {
      options.att = parseFloat(dict._att as string);
    }
    if (dict._flux) {
      options.flux = parseFloat(dict._flux as string);
    }
    if (dict._plastic) {
      options.plastic = !!parseInt(dict._plastic as string);
    }
    if (dict._unit) {
      options.unit = parseInt(dict._unit as string);
    }
    if (dict._glow) {
      options.glow = parseInt(dict._glow as string);
    }

    // TODO: Subsurface scattering

    return new MatlChunk(materialId, options);
  }

  readNtrnChunk(): NtrnChunk {
    this.readChunkHeader();
    const nodeId = this.readInt();
    const nodeDict = this.readDict();
    const name = nodeDict._name || '';
    const hidden = nodeDict._hidden === '1';
    const childNodeId = this.readInt();
    const reservedId = this.readInt();
    const layerId = this.readInt();
    const numFrames = this.readInt();
    const transforms: Matrix4[] = [];

    if (reservedId !== -1) {
      throw 'Expected -1';
    }

    if (numFrames !== 1) {
      throw 'Expected 1';
    }

    for (let i = 0; i < numFrames; i++) {
      transforms.push(this.readTransform());
    }

    // TODO: Only one frame is supported for now. Revisit once this changes.
    return new NtrnChunk(nodeId, name, hidden, childNodeId, layerId, transforms[0]);
  }

  readNgrpChunk(): NgrpChunk {
    this.readChunkHeader();
    const nodeId = this.readInt();
    this.readDict();
    const numChildNodes = this.readInt();
    const childNodeIds = [];
    for (let i = 0; i < numChildNodes; i++) {
      childNodeIds.push(this.readInt());
    }
    return new NgrpChunk(nodeId, childNodeIds);
  }

  readNshpChunk(): NshpChunk {
    this.readChunkHeader();
    const nodeId = this.readInt();
    this.readDict();
    const numModels = this.readInt();
    const modelIds = [];
    for (let i = 0; i < numModels; i++) {
      modelIds.push(this.readInt());
      this.readDict();
    }
    // TODO: Only one model is supported for now. Revisit once this changes.
    return new NshpChunk(nodeId, modelIds[0]);
  }

  readLayrChunk(): LayrChunk {
    this.readChunkHeader();
    const layerId = this.readInt();
    const dict = this.readDict();
    const name: string = dict._name || '';
    const hidden: boolean = dict._hidden === '1';
    const reservedId = this.readInt();
    if (reservedId !== -1) {
      throw 'Expected -1';
    }

    return new LayrChunk(layerId, name, hidden);
  }

  readUnsupportedChunk(): UnsupportedChunk {
    const {
      numBytesOfChunkContent,
      numBytesOfChildrenChunks
    } = this.readChunkHeader();
    this.skip(numBytesOfChunkContent + numBytesOfChildrenChunks);
    // TODO: Should probably log this.
    return new UnsupportedChunk();
  }

  readTransform(): Matrix4 {
    const dict: Dict = this.readDict();
    const rotation = dict._r;
    const translation = dict._t;
    // Row major
    const values = new Array<number>(16).fill(0);

    // Final row
    values[4 * 3 + 3] = 1;

    // Rotation
    if (rotation !== undefined) {
      const rotNum = parseInt(rotation);
      const j0 = rotNum >> 0 & 0b11;
      const j1 = rotNum >> 2 & 0b11;
      const j2 = ~(j0 | j1) & 0b11;
      const v0 = rotNum >> 4 & 0b1 ? -1 : 1;
      const v1 = rotNum >> 5 & 0b1 ? -1 : 1;
      const v2 = rotNum >> 6 & 0b1 ? -1 : 1;
      values[4 * 0 + j0] = v0;
      values[4 * 1 + j1] = v1;
      values[4 * 2 + j2] = v2;
    }
    else {
      values[4 * 0 + 0] = 1;
      values[4 * 1 + 1] = 1;
      values[4 * 2 + 2] = 1;
    }

    // Translation
    if (translation !== undefined) {
      const [x, y, z] = translation.split(' ').map(str => parseInt(str));
      values[4 * 0 + 3] = x;
      values[4 * 1 + 3] = y;
      values[4 * 2 + 3] = z;
    }
    const transform = new Matrix4();
    transform.set(
      values[0], values[1], values[2], values[3],
      values[4], values[5], values[6], values[7],
      values[8], values[9], values[10], values[11],
      values[12], values[12], values[14], values[15]
    )
    return transform;
  }
}
