import VoxelScene from "../Models/VoxelScene";
import ndarray from "ndarray";
import VoxelArt from "../Models/VoxelArt";
import { ModelHash } from "../Types/ModelHash";

// iOS 12.1 (16B91) Simulator's max is 4096.
export const MAX_TEXTURE_WIDTH = 4096;

function getTextureWidth(scene: VoxelScene): number {
  const { models } = scene;
  const fullVolume = models.reduce((
    volume, { size }) => volume + size.x * size.y * size.z,
    0
  );
  let width = 1;
  while (width * width * 4 < fullVolume) {
    width *= 2;
  }
  if (width > MAX_TEXTURE_WIDTH) {
    throw 'Texture size limit reached';
  }
  return width;
}

export default class ScenePacker {
  pack(scene: VoxelScene): [ModelHash[], ndarray] {
    const width = getTextureWidth(scene);
    const modelHashes: ModelHash[] = [];
    const textureData = new Uint8Array(width * width * 4);
    const { models } = scene;
    let byteOffset = 0;
    models.forEach((model: VoxelArt, index: number) => {
      textureData.set(model.data, byteOffset);
      modelHashes.push({
        index,
        pos: model.pos.toArray(),
        size: model.size.toArray(),
        byteOffset
      });
      byteOffset += model.data.length;
    });
    const packedTexture = ndarray(textureData, [width, width, 4]);
    return [modelHashes, packedTexture];
  }
}
