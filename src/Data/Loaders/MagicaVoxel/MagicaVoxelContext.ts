import VoxelScene from "../../Models/VoxelScene";
import VoxelArt from "../../Models/VoxelArt";
import MaterialArray from "../../Arrays/MaterialArray";
import Context from "../Context";
import { readInt, readFloat, readStr, uint8 } from "../ByteUtil";
import { Vector3, Matrix4, Vector4 } from "three";
import Chunk from "./Chunks/Chunk";
import MainChunk from "./Chunks/MainChunk";
import MatlChunk, { MatlChunkOptions } from "./Chunks/MatlChunk";
import MattChunk from "./Chunks/MattChunk";
import PackChunk from "./Chunks/PackChunk";
import RgbaChunk from "./Chunks/RgbaChunk";
import SizeChunk from "./Chunks/SizeChunk";
import XyziChunk from "./Chunks/XyziChunk";
import UnsupportedChunk from "./Chunks/UnsupportedChunk";
import MaterialType from "../../../Enums/MaterialType";
import ColorArray from "../../Arrays/ColorArray";
import DiffuseMaterial from "../../Materials/DiffuseMaterial";
import MetallicMaterial from "../../Materials/MetallicMaterial";
import GlassMaterial from "../../Materials/GlassMaterial";
import EmmissiveMaterial from "../../Materials/EmissiveMaterial";

// /**
//  * Dictionary type
//  */
// enum AttributeValueType {
//   'String' = 'string',
//   'Integer' = 'int',
//   'Float' = 'float'
// }

// /**
//  * Dictionary preset
//  */
// type AttributePreset = {
//   [key: string]: AttributeValueType;
// }

/**
 * Dictionary
 */
type Dict = {
  [key: string]: string | number;
  numBytes: number;
}

// /**
//  * Dictionary preset for MATL attributes
//  */
// const matlAttributePreset: AttributePreset = {
//   _type
//   _weight
//   _rough
//   _spec
//   _ior
//   _att
//   _flux
//   _plastic
// }

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
    const colors: ColorArray = new ColorArray();
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
          colors.setAt(i + 1, color);
        }
      }
      else if(chunk instanceof MatlChunk) {
        const { materialId, options } = chunk;
        let material;
        switch(options.type) {
          case MaterialType.METAL: material = new MetallicMaterial(options.weight!, options.rough!, options.spec!, options.plastic!); break;
          case MaterialType.GLASS: material = new GlassMaterial(options.weight!, options.rough!, options.ior!, options.att!); break;
          case MaterialType.EMISSIVE: material = new EmmissiveMaterial(options.weight!, options.flux!, 0); break;
          default: material = new DiffuseMaterial();
        }
        materials.setAt(materialId, material);
      }

    }

    console.log(mainChunk, models, colors, materials);

    return new VoxelScene(models, colors, materials);
  }

  private parseDict(buffer: ArrayBuffer, byteOffset: number): Dict {
    const total = readInt(buffer, byteOffset);
    const result: Dict = {
      numBytes: 0
    };
    let cursor = byteOffset + 4;
    for (let i = 0; i < total; ++i) {
      const keyLen = readInt(buffer, cursor);
      const key = readStr(buffer, cursor + 4, keyLen);
      const valueStart = cursor + keyLen + 4;
      const valueLen = readInt(buffer, valueStart);
      const value = readStr(buffer, valueStart + 4, valueLen);
      cursor = valueStart + valueLen + 4;
      result[key] = value;
    }
    result.numBytes = cursor - byteOffset;
    return result;
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
    else if (chunkId === 'MATL') {
      const materialId = readInt(buffer, contentStart);
      const dict = this.parseDict(buffer, contentStart + 4);

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
        options.weight = parseFloat(dict._weight as string);
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

      chunk = new MatlChunk(materialId, options);
    }
    else {
      // console.log(`Skipping unsupported chunk type "${chunkId}"`);
      chunk = new UnsupportedChunk();
    }

    chunk.size = chunkSize;

    return chunk;
  }

}
