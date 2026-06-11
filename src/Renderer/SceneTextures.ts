import * as THREE from 'three';
import { Matrix3, Matrix4, Vector3 } from 'three';
import { NdArray } from 'ndarray';
import VoxelScene from '../Data/Models/VoxelScene';
import VoxelArt from '../Data/Models/VoxelArt';
import Obj from '../Data/Models/Obj';
import ShapeHash from '../Data/Types/ShapeHash';
import { AtlasLayout, packAtlas } from '../Data/Packers/AtlasPacker';
import { buildShapeBvh, shapeWorldAabb } from '../Data/Packers/ShapeBvh';

/** texels per shape row in the RGBA32F shape texture */
export const SHAPE_TEX_WIDTH = 8;

function decomposeModelMatrix(modelMatrix: Matrix4): [Matrix3, Vector3] {
  const translation = new Vector3(
    modelMatrix.elements[12],
    modelMatrix.elements[13],
    modelMatrix.elements[14]
  );
  // Assumes rigid transforms (MagicaVoxel emits rotation+translation only).
  const rotation = new Matrix3().setFromMatrix4(new Matrix4().extractRotation(modelMatrix));
  return [rotation, translation];
}

function walkShapeHashes(
  obj: Obj,
  models: VoxelArt[],
  layout: AtlasLayout,
  parentTransform: Matrix4,
  out: ShapeHash[]
): void {
  if (obj.hidden) return;
  const modelMatrix = parentTransform.clone().multiply(obj.transform);
  if (obj.modelIndex !== -1) {
    const model = models[obj.modelIndex];
    const [rotation, translation] = decomposeModelMatrix(modelMatrix);
    out.push({
      modelIndex: obj.modelIndex,
      rotation: rotation.toArray(),
      translation: translation.toArray(),
      size: model.size.toArray(),
      pos: model.pos.toArray(),
      atlasOffset: layout.placements[obj.modelIndex].offset,
    });
  }
  obj.children?.forEach((child) => walkShapeHashes(child, models, layout, modelMatrix, out));
}

export function collectShapeHashes(scene: VoxelScene, layout: AtlasLayout): ShapeHash[] {
  const out: ShapeHash[] = [];
  walkShapeHashes(scene.rootObj, scene.models, layout, new Matrix4(), out);
  return out;
}

/** Copies every model's voxel bytes into a single 3D atlas buffer. */
export function buildAtlasData(models: VoxelArt[], layout: AtlasLayout): Uint8Array {
  const [w, h, d] = layout.size;
  const data = new Uint8Array(w * h * d);
  models.forEach((model, index) => {
    const [ox, oy, oz] = layout.placements[index].offset;
    const sx = model.size.x;
    const sy = model.size.y;
    const sz = model.size.z;
    for (let z = 0; z < sz; z++) {
      for (let y = 0; y < sy; y++) {
        const srcRow = (z * sy + y) * sx;
        const dstRow = ((z + oz) * h + (y + oy)) * w + ox;
        data.set(model.data.subarray(srcRow, srcRow + sx), dstRow);
      }
    }
  });
  return data;
}

/**
 * Packs shape metadata into an RGBA32F texture, SHAPE_TEX_WIDTH texels per
 * shape (one shape per row):
 *   texel 0..2: rotation matrix rows in .xyz, translation component in .w
 *   texel 3:    size
 *   texel 4:    pos (pivot)
 *   texel 5:    atlas offset
 */
export function buildShapeTexData(hashes: ShapeHash[]): Float32Array {
  const data = new Float32Array(SHAPE_TEX_WIDTH * 4 * Math.max(hashes.length, 1));
  hashes.forEach((hash, i) => {
    const base = i * SHAPE_TEX_WIDTH * 4;
    const r = hash.rotation; // column-major: row k of M is (r[k], r[k+3], r[k+6])
    for (let k = 0; k < 3; k++) {
      data[base + k * 4 + 0] = r[k];
      data[base + k * 4 + 1] = r[k + 3];
      data[base + k * 4 + 2] = r[k + 6];
      data[base + k * 4 + 3] = hash.translation[k];
    }
    data.set(hash.size, base + 3 * 4);
    data.set(hash.pos, base + 4 * 4);
    data.set(hash.atlasOffset, base + 5 * 4);
  });
  return data;
}

/**
 * Re-orders a 16x16 palette/material ndarray (indexed [i=index%16, j=index/16])
 * into GPU row-major layout so the shader can texelFetch at
 * ivec2(index % 16, index / 16).
 */
export function build16x16Data(nd: NdArray): Uint8Array {
  const out = new Uint8Array(16 * 16 * 4);
  for (let p = 0; p < 256; p++) {
    const i = p % 16;
    const j = Math.floor(p / 16);
    for (let c = 0; c < 4; c++) {
      out[(j * 16 + i) * 4 + c] = nd.get(i, j, c) as number;
    }
  }
  return out;
}

export class SceneTextures {
  readonly atlas: THREE.Data3DTexture;
  readonly shapeTex: THREE.DataTexture;
  readonly bvhTex: THREE.DataTexture;
  readonly colorTex: THREE.DataTexture;
  readonly materialTex: THREE.DataTexture;
  readonly shapeCount: number;

  private constructor(
    atlas: THREE.Data3DTexture,
    shapeTex: THREE.DataTexture,
    bvhTex: THREE.DataTexture,
    colorTex: THREE.DataTexture,
    materialTex: THREE.DataTexture,
    shapeCount: number
  ) {
    this.atlas = atlas;
    this.shapeTex = shapeTex;
    this.bvhTex = bvhTex;
    this.colorTex = colorTex;
    this.materialTex = materialTex;
    this.shapeCount = shapeCount;
  }

  static fromScene(scene: VoxelScene, maxAtlasSize: number): SceneTextures {
    const sizes = scene.models.map(
      (m): [number, number, number] => [m.size.x, m.size.y, m.size.z]
    );
    const layout = packAtlas(sizes, maxAtlasSize);
    const collected = collectShapeHashes(scene, layout);

    // BVH over world-space shape AABBs; shapes are reordered so leaves
    // reference contiguous rows of the shape texture.
    const bvh = buildShapeBvh(collected.map(shapeWorldAabb));
    const hashes = bvh.order.map((i) => collected[i]);

    const [w, h, d] = layout.size;
    const atlas = new THREE.Data3DTexture(buildAtlasData(scene.models, layout), w, h, d);
    atlas.format = THREE.RedIntegerFormat;
    atlas.type = THREE.UnsignedByteType;
    atlas.internalFormat = 'R8UI';
    atlas.minFilter = THREE.NearestFilter;
    atlas.magFilter = THREE.NearestFilter;
    atlas.unpackAlignment = 1;
    atlas.needsUpdate = true;

    const shapeTex = new THREE.DataTexture(
      buildShapeTexData(hashes),
      SHAPE_TEX_WIDTH,
      Math.max(hashes.length, 1),
      THREE.RGBAFormat,
      THREE.FloatType
    );
    shapeTex.minFilter = THREE.NearestFilter;
    shapeTex.magFilter = THREE.NearestFilter;
    shapeTex.needsUpdate = true;

    const bvhTex = new THREE.DataTexture(
      bvh.nodes,
      2,
      bvh.nodeCount,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    bvhTex.minFilter = THREE.NearestFilter;
    bvhTex.magFilter = THREE.NearestFilter;
    bvhTex.needsUpdate = true;

    const colorTex = new THREE.DataTexture(
      build16x16Data(scene.colors.colorTexture),
      16,
      16,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    );
    colorTex.minFilter = THREE.NearestFilter;
    colorTex.magFilter = THREE.NearestFilter;
    colorTex.needsUpdate = true;

    const materialTex = new THREE.DataTexture(
      build16x16Data(scene.materials.materialTexture),
      16,
      16,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    );
    materialTex.minFilter = THREE.NearestFilter;
    materialTex.magFilter = THREE.NearestFilter;
    materialTex.needsUpdate = true;

    return new SceneTextures(atlas, shapeTex, bvhTex, colorTex, materialTex, hashes.length);
  }

  dispose(): void {
    this.atlas.dispose();
    this.shapeTex.dispose();
    this.bvhTex.dispose();
    this.colorTex.dispose();
    this.materialTex.dispose();
  }
}
