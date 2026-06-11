import { describe, it, expect } from 'vitest';
import { buildVox } from '../../../scripts/voxBuilder.mjs';
import MagicaVoxelContext from './MagicaVoxelContext';
import MaterialType from '../../Enums/MaterialType';

// MagicaVoxel is z-up; the parser changes basis to OpenGL (y-up):
// sizes map (x, y, z) -> (x, z, y) and voxel cells (x, y, z) -> (x, z, sizeY - 1 - y).

function parse(bytes: Uint8Array<ArrayBuffer>) {
  return new MagicaVoxelContext().parseScene(bytes.buffer);
}

describe('MagicaVoxelContext.parseScene', () => {
  it('parses a single-model file', () => {
    const bytes = buildVox({
      models: [{ size: [2, 3, 4], voxels: [[0, 0, 0, 1], [1, 2, 3, 5]] }],
    });
    const scene = parse(bytes);

    expect(scene.models).toHaveLength(1);
    const model = scene.models[0];
    expect([model.size.x, model.size.y, model.size.z]).toEqual([2, 4, 3]);

    // voxel (0,0,0) -> GL cell (0, 0, 2): index = 2 * (4*2) + 0 + 0
    expect(model.data[2 * 4 * 2]).toBe(1);
    // voxel (1,2,3) -> GL cell (1, 3, 0): index = 0 + 3*2 + 1
    expect(model.data[3 * 2 + 1]).toBe(5);
    // exactly two voxels set
    expect(model.data.filter((v) => v !== 0)).toHaveLength(2);
  });

  it('maps palette entry i to palette index i + 1', () => {
    const bytes = buildVox({
      models: [{ size: [1, 1, 1], voxels: [[0, 0, 0, 1]] }],
      palette: [[10, 20, 30, 255]],
    });
    const scene = parse(bytes);
    const tex = scene.colors.colorTexture;
    expect(tex.get(1, 0, 0)).toBe(10);
    expect(tex.get(1, 0, 1)).toBe(20);
    expect(tex.get(1, 0, 2)).toBe(30);
    expect(tex.get(1, 0, 3)).toBe(255);
  });

  it('parses a multi-model scene graph with translations', () => {
    const bytes = buildVox({
      models: [
        { size: [2, 2, 2], voxels: [[0, 0, 0, 1]] },
        { size: [3, 3, 3], voxels: [[1, 1, 1, 2]] },
      ],
      translations: [
        [10, 20, 30],
        [-5, 0, 8],
      ],
    });
    const scene = parse(bytes);

    expect(scene.models).toHaveLength(2);
    const children = scene.rootObj.children!;
    expect(children).toHaveLength(2);
    expect(children.map((c) => c.modelIndex)).toEqual([0, 1]);

    // MagicaVoxel translation (x, y, z) -> OpenGL (x, z, -y)
    const t0 = children[0].transform.elements;
    expect([t0[12], t0[13], t0[14]]).toEqual([10, 30, -20]);
    const t1 = children[1].transform.elements;
    expect([t1[12], t1[13], t1[14]]).toEqual([-5, 8, 0]);
  });

  it('parses MATL chunks into the material texture', () => {
    const bytes = buildVox({
      models: [{ size: [1, 1, 1], voxels: [[0, 0, 0, 5]] }],
      materials: [[5, { _type: '_metal', _metal: '0.8', _rough: '0.2', _spec: '0.5' }]],
    });
    const scene = parse(bytes);
    const tex = scene.materials.materialTexture;
    expect(tex.get(5, 0, 0)).toBe(MaterialType.METAL);
    expect(tex.get(5, 0, 1)).toBe(Math.round(0.8 * 255));
    expect(tex.get(5, 0, 2)).toBe(Math.round(0.2 * 255));
    expect(tex.get(5, 0, 3)).toBe(Math.round(0.5 * 255));
  });

  it('parses legacy files without a scene graph (models at origin)', () => {
    const bytes = buildVox({
      models: [
        { size: [2, 2, 2], voxels: [[0, 0, 0, 1]] },
        { size: [2, 2, 2], voxels: [[1, 1, 1, 2]] },
      ],
      sceneGraph: false,
    });
    const scene = parse(bytes);
    expect(scene.models).toHaveLength(2);
    expect(scene.rootObj.children).toHaveLength(2);
    expect(scene.rootObj.children!.map((c) => c.modelIndex)).toEqual([0, 1]);
  });

  it('rejects non-vox bytes', () => {
    expect(() => parse(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow();
  });
});
