import VoxelScene from "../Models/VoxelScene";
import ndarray from "ndarray";
import VoxelArt from "../Models/VoxelArt";
import Obj from "../Models/Obj";
import { Matrix4, Vector3, Matrix3 } from "three";
import ShapeHash from "../Types/ShapeHash"

// iOS 12.1 (16B91) Simulator's max is 4096.
export const MAX_TEXTURE_WIDTH = 4096;

function getTextureWidth(scene: VoxelScene): number {
  const { models } = scene;
  const fullVolume = models.reduce((
    volume, { size }) => volume + size.x * size.y * size.z,
    0
  );
  console.log("!!!Total Volume", fullVolume, "models", models.length);
  let width = 1;
  while (width * width * 4 < fullVolume) {
    width *= 2;
  }
  if (width > MAX_TEXTURE_WIDTH) {
    throw 'Texture size limit reached';
  }
  console.log("!!!models", models)
  console.log("!!!Texture Width", width);
  return width;
}

function decomposeModelMatrix(modelMatrix: Matrix4): [Matrix3, Vector3] {
  const translation: Vector3 = new Vector3(
    modelMatrix.elements[12],
    modelMatrix.elements[13],
    modelMatrix.elements[14]
  );
  // TODO: Check what happens for flips
  // TODO: Make sure it is okay to assume no scaling.
  const rotation: Matrix3 = (new Matrix3()).setFromMatrix4((new Matrix4()).extractRotation(modelMatrix));
  return [rotation, translation];
}

function getShapeHashes(obj: Obj, models: VoxelArt[], byteOffsets: number[], parentTransform: Matrix4 = new Matrix4()): ShapeHash[] {
  const { modelIndex, hidden } = obj;
  const modelMatrix: Matrix4 = parentTransform.clone().multiply(obj.transform);
  const shapeHashes: ShapeHash[] = [];
  const [rotation, translation] = decomposeModelMatrix(modelMatrix);
  if (!hidden) {
    if (modelIndex !== -1) {
      const model = models[modelIndex];
      const size = model.size.toArray();
      const pos = model.pos.toArray();
      const byteOffset = byteOffsets[modelIndex];
      shapeHashes.push({
        modelIndex,
        rotation: rotation.toArray(),
        translation: translation.toArray(),
        size,
        pos,
        byteOffset
      });
    }
    if (obj.children) {
      obj.children.forEach((childObj) => {
        shapeHashes.push(...getShapeHashes(childObj, models, byteOffsets, modelMatrix));
      })
    }
  }
  return shapeHashes;
}

export default class ScenePacker {
  pack(scene: VoxelScene): [ShapeHash[], ndarray] {
    const width = getTextureWidth(scene);
    const byteOffsets: number[] = [];
    const textureData = new Uint8Array(width * width * 4);
    const { models } = scene;
    let byteOffset = 0;
    models.forEach((model: VoxelArt, index: number) => {
      textureData.set(model.data, byteOffset);
      byteOffsets.push(byteOffset);
      byteOffset += model.data.length;
    });
    const packedTexture = ndarray(textureData, [width, width, 4]);
    const shapeHashes: ShapeHash[] = getShapeHashes(scene.rootObj, models, byteOffsets);
    return [shapeHashes, packedTexture];
  }
}
