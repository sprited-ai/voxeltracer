import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import ndarray from 'ndarray';
import VoxelArt from '../Data/Models/VoxelArt';
import { buildAtlasData, buildShapeTexData, build16x16Data, SHAPE_TEX_WIDTH } from './SceneTextures';
import { AtlasLayout } from '../Data/Packers/AtlasPacker';
import ShapeHash from '../Data/Types/ShapeHash';

describe('buildAtlasData', () => {
  it('writes model voxels at their atlas offsets', () => {
    const model = new VoxelArt(new Vector3(), new Vector3(2, 2, 2));
    model.setVoxel(1, 0, 1, 7);
    const layout: AtlasLayout = {
      size: [12, 4, 4],
      placements: [{ offset: [8, 0, 0] }],
    };
    const data = buildAtlasData([model], layout);
    // atlas cell (9, 0, 1) => index (1 * 4 + 0) * 12 + 9
    expect(data[(1 * 4 + 0) * 12 + 9]).toBe(7);
    expect(data.filter((v) => v !== 0)).toHaveLength(1);
  });
});

describe('buildShapeTexData', () => {
  it('packs rotation rows, translation, size, pos, atlasOffset', () => {
    const hash: ShapeHash = {
      modelIndex: 0,
      // column-major: M = [[1,4,7],[2,5,8],[3,6,9]] (row k = k+1, k+4, k+7)
      rotation: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      translation: [10, 11, 12],
      size: [13, 14, 15],
      pos: [-1, -2, -3],
      atlasOffset: [16, 17, 18],
    };
    const data = buildShapeTexData([hash]);
    expect(data).toHaveLength(SHAPE_TEX_WIDTH * 4);
    // texel 0: row 0 of M + tx
    expect([...data.slice(0, 4)]).toEqual([1, 4, 7, 10]);
    // texel 1: row 1 of M + ty
    expect([...data.slice(4, 8)]).toEqual([2, 5, 8, 11]);
    // texel 2: row 2 of M + tz
    expect([...data.slice(8, 12)]).toEqual([3, 6, 9, 12]);
    // texel 3..5
    expect([...data.slice(12, 15)]).toEqual([13, 14, 15]);
    expect([...data.slice(16, 19)]).toEqual([-1, -2, -3]);
    expect([...data.slice(20, 23)]).toEqual([16, 17, 18]);
  });
});

describe('build16x16Data', () => {
  it('re-orders ndarray (i=index%16, j=index/16) into row-major texels', () => {
    const nd = ndarray(new Uint8Array(16 * 16 * 4), [16, 16, 4]);
    // palette index 18 -> i=2, j=1
    nd.set(2, 1, 0, 200);
    nd.set(2, 1, 3, 255);
    const out = build16x16Data(nd);
    // texel (x=2, y=1) -> (1 * 16 + 2) * 4
    expect(out[(1 * 16 + 2) * 4 + 0]).toBe(200);
    expect(out[(1 * 16 + 2) * 4 + 3]).toBe(255);
  });
});
