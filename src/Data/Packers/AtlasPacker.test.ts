import { describe, it, expect } from 'vitest';
import { packAtlas } from './AtlasPacker';

type Size = [number, number, number];

function overlaps(a: { offset: Size; size: Size }, b: { offset: Size; size: Size }) {
  for (let axis = 0; axis < 3; axis++) {
    if (a.offset[axis] + a.size[axis] <= b.offset[axis]) return false;
    if (b.offset[axis] + b.size[axis] <= a.offset[axis]) return false;
  }
  return true;
}

describe('packAtlas', () => {
  it('places a single model at the origin', () => {
    const layout = packAtlas([[8, 16, 4]], 2048);
    expect(layout.placements).toEqual([{ offset: [0, 0, 0] }]);
    expect(layout.size).toEqual([8, 16, 4]);
  });

  it('places models along x within a row', () => {
    const layout = packAtlas(
      [
        [8, 8, 8],
        [8, 8, 8],
      ],
      2048
    );
    expect(layout.placements[1].offset).toEqual([8, 0, 0]);
    expect(layout.size).toEqual([16, 8, 8]);
  });

  it('wraps to a new y-row when x overflows', () => {
    const layout = packAtlas(
      [
        [10, 4, 4],
        [10, 6, 4],
      ],
      16
    );
    expect(layout.placements[1].offset).toEqual([0, 4, 0]);
    expect(layout.size).toEqual([10, 10, 4]);
  });

  it('wraps to a new z-layer when y overflows', () => {
    const layout = packAtlas(
      [
        [10, 10, 4],
        [10, 10, 6],
      ],
      16
    );
    expect(layout.placements[1].offset).toEqual([0, 0, 4]);
    expect(layout.size).toEqual([10, 10, 10]);
  });

  it('throws when the scene cannot fit', () => {
    expect(() =>
      packAtlas(
        [
          [16, 16, 16],
          [16, 16, 16],
        ],
        16
      )
    ).toThrow(/does not fit/);
  });

  it('throws when a single model exceeds the limit', () => {
    expect(() => packAtlas([[300, 8, 8]], 256)).toThrow(/exceeds/);
  });

  it('never overlaps placements (stress shapes)', () => {
    const sizes: Size[] = [];
    for (let i = 0; i < 200; i++) {
      sizes.push([16 + (i * 7) % 240, 16 + (i * 13) % 200, 16 + (i * 5) % 100]);
    }
    const layout = packAtlas(sizes, 2048);
    const boxes = layout.placements.map((p, i) => ({ offset: p.offset, size: sizes[i] }));
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        expect(overlaps(boxes[i], boxes[j])).toBe(false);
      }
      // contained in atlas
      for (let axis = 0; axis < 3; axis++) {
        expect(boxes[i].offset[axis] + boxes[i].size[axis]).toBeLessThanOrEqual(layout.size[axis]);
      }
    }
  });
});
