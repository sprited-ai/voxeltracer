import { Vector3, Matrix4, Vector4, Color } from "three";
import MatlChunk from "./Chunks/MatlChunk";
import PackChunk from "./Chunks/PackChunk";
import RgbaChunk from "./Chunks/RgbaChunk";
import SizeChunk from "./Chunks/SizeChunk";
import XyziChunk from "./Chunks/XyziChunk";
import VoxelScene from "../Models/VoxelScene";
import MagicaVoxelReader from "./Readers/MagicaVoxelReader";
import Context from "../Loaders/Context";
import VoxelArt from "../Models/VoxelArt";
import ColorArray from "../Arrays/ColorArray";
import MaterialArray from "../Arrays/MaterialArray";
import MetallicMaterial from "../Materials/MetallicMaterial";
import GlassMaterial from "../Materials/GlassMaterial";
import MaterialType from "../../Enums/MaterialType";
import EmmissiveMaterial from "../Materials/EmissiveMaterial";
import DiffuseMaterial from "../Materials/DiffuseMaterial";
import Chunk from "./Chunks/Chunk";
import NtrnChunk from "./Chunks/NtrnChunk";
import NgrpChunk from "./Chunks/NgrpChunk";
import NshpChunk from "./Chunks/NshpChunk";
import Obj from "../Models/Obj";

type NodeChunkMap = { [nodeId: string]: Chunk };

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

  public parseScene(buffer: ArrayBuffer): VoxelScene {
    const reader = new MagicaVoxelReader(buffer);
    const magicaVoxelData = reader.readFile();
    const { mainChunk } = magicaVoxelData;

    const chunkMap: NodeChunkMap = {};
    let rgbaChunk: RgbaChunk | undefined;
    const matlChunks: MatlChunk[] = [];
    const models: VoxelArt[] = [];

    let prevChunk: Chunk | undefined;
    for (let i = 0; i < mainChunk.children.length; ++i) {
      const chunk = mainChunk.children[i];
      if (chunk instanceof PackChunk) {
        // ignore, since we support single frame only.
      }
      else if(chunk instanceof SizeChunk) {
        // ignore since it will be consumed when XyziChunk is being consumed.
      }
      else if(chunk instanceof XyziChunk) {
        if (prevChunk instanceof SizeChunk) {
          models.push(this.parseXyziChunk(prevChunk, chunk));
        }
        else {
          throw 'Missing size chunk.';
        }
      }
      else if(chunk instanceof NtrnChunk) {
        chunkMap[chunk.nodeId] = chunk;
      }
      else if(chunk instanceof NgrpChunk) {
        chunkMap[chunk.nodeId] = chunk;
      }
      else if(chunk instanceof NshpChunk) {
        chunkMap[chunk.nodeId] = chunk;
      }
      else if(chunk instanceof RgbaChunk) {
        rgbaChunk = chunk;
      }
      else if(chunk instanceof MatlChunk) {
        matlChunks.push(chunk);
      }
      prevChunk = chunk;
    }
    const rootObj: Obj = this.parseNodeChunks(chunkMap);
    const colors = this.parseRgbaChunk(rgbaChunk);
    const materials = this.parseMatlChunks(matlChunks);

    // Using defaults
    const groundColor = new Color(0x505050);
    const skyColor = new Color(0xedfffc);
    const lightColor = new Color(0x877e68);

    // console.log(mainChunk, models, colors, materials);
    return new VoxelScene(
      rootObj,
      models,
      materials,
      colors,
      groundColor,
      lightColor,
      skyColor
    );
  }

  private parseNodeChunks(chunkMap: NodeChunkMap): Obj {
    const rootChunk: Chunk = chunkMap[0];
    if (!(rootChunk instanceof NtrnChunk)) {
      throw 'Expected root node chunk to be nTRN chunk.';
    }
    return this.parseNtrnChunk(rootChunk, chunkMap);
  }

  private parseNtrnChunk(ntrnChunk: NtrnChunk, chunkMap: NodeChunkMap): Obj {
    const childChunk: Chunk = chunkMap[ntrnChunk.childNodeId];
    const name: string = ntrnChunk.name;
    // Change of basis
    const transform: Matrix4 = magicaVoxelToOpenGlCoordinates.clone()
      .multiply(ntrnChunk.transform)
      .multiply(magicaVoxelToOpenGlCoordinates.clone().transpose());

    console.log(transform);

    const hidden: boolean = ntrnChunk.hidden;
    let modelIndex: number = -1;
    let children: Obj[] | undefined;
    if (childChunk instanceof NgrpChunk) {
      children = childChunk.childNodeIds.map((groupChildNodeId)=> {
        const groupChildChunk = chunkMap[groupChildNodeId];
        if (!(groupChildChunk instanceof NtrnChunk)) {
          throw "Expected nTRN chunk as child of group chunk";
        }
        return this.parseNtrnChunk(groupChildChunk, chunkMap);
      })
    }
    else if (childChunk instanceof NshpChunk) {
      modelIndex = childChunk.modelId;
    }
    else {
      throw 'Unknown node chunk type encountered while parsing node chunks.';
    }
    return new Obj(name, transform, modelIndex, hidden, children);
  }

  private parseXyziChunk(sizeChunk: SizeChunk, xyziChunk: XyziChunk): VoxelArt {
    const rawSize = new Vector3(sizeChunk.x, sizeChunk.y, sizeChunk.z);
    const size = rawSize.applyMatrix4(magicaVoxelToOpenGlCoordinates);
    size.z = -size.z;
    // pivot location
    const pos = new Vector3(
      -Math.floor(size.x / 2),
      -Math.floor(size.y / 2),
      Math.floor(-size.z / 2),
    );
    const model = new VoxelArt(pos, size);
    const { xyzis } = xyziChunk;
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
      model.setVoxel(xyz.x, xyz.y, size.z + xyz.z - 1, i);
    }
    return model;
  }

  private parseRgbaChunk(chunk?: RgbaChunk): ColorArray {
    const colors: ColorArray = new ColorArray();
    // If no rgba chunk, ColorArray has the default palette.
    if (chunk) {
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
    return colors;
  }

  private parseMatlChunks(chunks: MatlChunk[]): MaterialArray {
    const materials: MaterialArray = new MaterialArray();
    chunks.forEach(({ materialId, options }) => {
      let material;
        // TODO: Magica voxel has `_unit` in emmissive materials which we are not handling right now.
        switch(options.type) {
          case MaterialType.METAL: material = new MetallicMaterial(options.weight!, options.rough!, options.spec!, !!options.plastic!); break;
          case MaterialType.GLASS: material = new GlassMaterial(options.weight!, options.rough!, options.ior!, options.att!); break;
          case MaterialType.EMISSIVE: material = new EmmissiveMaterial(options.weight!, options.flux!, options.glow!); break;
          default: material = new DiffuseMaterial();
        }
        materials.setAt(materialId, material);
    });
    return materials;
  }
}
