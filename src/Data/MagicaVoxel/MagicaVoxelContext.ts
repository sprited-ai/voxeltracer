import { Vector3, Matrix4, Vector4 } from "three";
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

    const models: VoxelArt[] = [];
    const colors: ColorArray = new ColorArray();
    const materials: MaterialArray = new MaterialArray();

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

        // pivot location
        const pos = new Vector3(
          0,
          0,
          -size.z,
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
          model.setVoxel(xyz.x, xyz.y, size.z + xyz.z - 1, i);
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
        // TODO: Magica voxel has `_unit` in emmissive materials which we are not handling right now.
        switch(options.type) {
          case MaterialType.METAL: material = new MetallicMaterial(options.weight!, options.rough!, options.spec!, !!options.plastic!); break;
          case MaterialType.GLASS: material = new GlassMaterial(options.weight!, options.rough!, options.ior!, options.att!); break;
          case MaterialType.EMISSIVE: material = new EmmissiveMaterial(options.weight!, options.flux!, options.glow!); break;
          default: material = new DiffuseMaterial();
        }
        materials.setAt(materialId, material);
      }
    }
    console.log(mainChunk, models, colors, materials);
    return new VoxelScene(models, colors, materials);
  }
}
