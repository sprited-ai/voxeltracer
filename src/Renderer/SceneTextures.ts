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

/** Backend-neutral GPU-ready scene data (raw arrays + dimensions). */
export interface SceneData {
  atlas: Uint8Array;
  atlasSize: [number, number, number];
  shapes: Float32Array;
  shapeCount: number;
  bvh: Float32Array;
  bvhNodeCount: number;
  lights: Float32Array;
  lightCount: number;
  /** 16x16 RGBA8 row-major, texel = ivec2(index % 16, index / 16) */
  palette: Uint8Array;
  materials: Uint8Array;
}

export function buildSceneData(scene: VoxelScene, maxAtlasSize: number): SceneData {
  const sizes = scene.models.map(
    (m): [number, number, number] => [m.size.x, m.size.y, m.size.z]
  );
  const layout = packAtlas(sizes, maxAtlasSize);
  const collected = collectShapeHashes(scene, layout);

  // BVH over world-space shape AABBs; shapes are reordered so leaves
  // reference contiguous rows of the shape texture/buffer.
  const bvh = buildShapeBvh(collected.map(shapeWorldAabb));
  const hashes = bvh.order.map((i) => collected[i]);
  const lightList = buildLightListData(scene, hashes);

  return {
    atlas: buildAtlasData(scene.models, layout),
    atlasSize: layout.size,
    shapes: buildShapeTexData(hashes),
    shapeCount: hashes.length,
    bvh: bvh.nodes,
    bvhNodeCount: bvh.nodeCount,
    lights: lightList.data,
    lightCount: lightList.count,
    palette: build16x16Data(scene.colors.colorTexture),
    materials: build16x16Data(scene.materials.materialTexture),
  };
}

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

export const MAX_LIGHTS = 4096;

/**
 * Collects world-space centers of emissive voxels across all shape
 * instances — the light list for next-event estimation. One RGBA32F texel
 * per light: [x, y, z, materialIndex]. Evenly strided down to `cap` when a
 * scene has more emissive voxels than that.
 */
export function buildLightListData(
  scene: VoxelScene,
  hashes: ShapeHash[],
  cap = MAX_LIGHTS
): { data: Float32Array; count: number } {
  const emissive = new Set<number>();
  const mat = scene.materials.materialTexture;
  for (let p = 1; p < 256; p++) {
    if ((mat.get(p % 16, Math.floor(p / 16), 0) as number) === 3) emissive.add(p);
  }

  const lights: number[] = [];
  if (emissive.size > 0) {
    // per-model emissive cells, computed once and instanced per shape
    const modelCells = new Map<number, number[]>();
    const cellsFor = (modelIndex: number): number[] => {
      let cells = modelCells.get(modelIndex);
      if (!cells) {
        cells = [];
        const model = scene.models[modelIndex];
        const sx = model.size.x;
        const sy = model.size.y;
        const sz = model.size.z;
        const at = (x: number, y: number, z: number) =>
          x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz
            ? 0
            : model.data[(z * sy + y) * sx + x];
        for (let z = 0; z < sz; z++) {
          for (let y = 0; y < sy; y++) {
            for (let x = 0; x < sx; x++) {
              const m = at(x, y, z);
              if (!emissive.has(m)) continue;
              // surface voxels only — interior emitters are always occluded
              const exposed =
                !at(x - 1, y, z) || !at(x + 1, y, z) ||
                !at(x, y - 1, z) || !at(x, y + 1, z) ||
                !at(x, y, z - 1) || !at(x, y, z + 1);
              if (exposed) cells.push(x, y, z, m);
            }
          }
        }
        modelCells.set(modelIndex, cells);
      }
      return cells;
    };

    for (const hash of hashes) {
      const cells = cellsFor(hash.modelIndex);
      const r = hash.rotation; // column-major
      const t = hash.translation;
      for (let c = 0; c < cells.length; c += 4) {
        const lx = hash.pos[0] + cells[c] + 0.5;
        const ly = hash.pos[1] + cells[c + 1] + 0.5;
        const lz = hash.pos[2] + cells[c + 2] + 0.5;
        lights.push(
          r[0] * lx + r[3] * ly + r[6] * lz + t[0],
          r[1] * lx + r[4] * ly + r[7] * lz + t[1],
          r[2] * lx + r[5] * ly + r[8] * lz + t[2],
          cells[c + 3]
        );
      }
    }
  }

  let count = lights.length / 4;
  if (count > cap) {
    const strided: number[] = [];
    for (let i = 0; i < cap; i++) {
      const src = Math.floor((i * count) / cap) * 4;
      strided.push(lights[src], lights[src + 1], lights[src + 2], lights[src + 3]);
    }
    return { data: Float32Array.from(strided), count: cap };
  }
  return { data: Float32Array.from(lights.length ? lights : [0, 0, 0, 0]), count };
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
  readonly lightTex: THREE.DataTexture;
  readonly shapeCount: number;
  readonly lightCount: number;

  private constructor(
    atlas: THREE.Data3DTexture,
    shapeTex: THREE.DataTexture,
    bvhTex: THREE.DataTexture,
    colorTex: THREE.DataTexture,
    materialTex: THREE.DataTexture,
    lightTex: THREE.DataTexture,
    shapeCount: number,
    lightCount: number
  ) {
    this.atlas = atlas;
    this.shapeTex = shapeTex;
    this.bvhTex = bvhTex;
    this.colorTex = colorTex;
    this.materialTex = materialTex;
    this.lightTex = lightTex;
    this.shapeCount = shapeCount;
    this.lightCount = lightCount;
  }

  static fromScene(scene: VoxelScene, maxAtlasSize: number): SceneTextures {
    const data = buildSceneData(scene, maxAtlasSize);

    const [w, h, d] = data.atlasSize;
    const atlas = new THREE.Data3DTexture(data.atlas, w, h, d);
    atlas.format = THREE.RedIntegerFormat;
    atlas.type = THREE.UnsignedByteType;
    atlas.internalFormat = 'R8UI';
    atlas.minFilter = THREE.NearestFilter;
    atlas.magFilter = THREE.NearestFilter;
    atlas.unpackAlignment = 1;
    atlas.needsUpdate = true;

    const shapeTex = new THREE.DataTexture(
      data.shapes,
      SHAPE_TEX_WIDTH,
      Math.max(data.shapeCount, 1),
      THREE.RGBAFormat,
      THREE.FloatType
    );
    shapeTex.minFilter = THREE.NearestFilter;
    shapeTex.magFilter = THREE.NearestFilter;
    shapeTex.needsUpdate = true;

    const bvhTex = new THREE.DataTexture(
      data.bvh,
      2,
      data.bvhNodeCount,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    bvhTex.minFilter = THREE.NearestFilter;
    bvhTex.magFilter = THREE.NearestFilter;
    bvhTex.needsUpdate = true;

    const colorTex = new THREE.DataTexture(
      data.palette,
      16,
      16,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    );
    colorTex.minFilter = THREE.NearestFilter;
    colorTex.magFilter = THREE.NearestFilter;
    colorTex.needsUpdate = true;

    const materialTex = new THREE.DataTexture(
      data.materials,
      16,
      16,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    );
    materialTex.minFilter = THREE.NearestFilter;
    materialTex.magFilter = THREE.NearestFilter;
    materialTex.needsUpdate = true;

    const lightList = { data: data.lights, count: data.lightCount };
    const lightTex = new THREE.DataTexture(
      lightList.data,
      1,
      Math.max(lightList.count, 1),
      THREE.RGBAFormat,
      THREE.FloatType
    );
    lightTex.minFilter = THREE.NearestFilter;
    lightTex.magFilter = THREE.NearestFilter;
    lightTex.needsUpdate = true;

    return new SceneTextures(
      atlas,
      shapeTex,
      bvhTex,
      colorTex,
      materialTex,
      lightTex,
      data.shapeCount,
      lightList.count
    );
  }

  dispose(): void {
    this.atlas.dispose();
    this.shapeTex.dispose();
    this.bvhTex.dispose();
    this.colorTex.dispose();
    this.materialTex.dispose();
    this.lightTex.dispose();
  }
}
