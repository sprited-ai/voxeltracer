import { describe, it, expect } from 'vitest';
import { Aabb, buildShapeBvh, queryBvh, shapeWorldAabb } from './ShapeBvh';
import ShapeHash from '../Types/ShapeHash';

function box(min: [number, number, number], max: [number, number, number]): Aabb {
  return { min, max };
}

// deterministic pseudo-random (no Math.random in tests)
function lcg(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function bruteForce(aabbs: Aabb[], origin: number[], dir: number[]): Set<number> {
  const result = new Set<number>();
  aabbs.forEach((aabb, i) => {
    let tNear = -Infinity;
    let tFar = Infinity;
    for (let axis = 0; axis < 3; axis++) {
      const inv = 1 / dir[axis];
      const t1 = (aabb.min[axis] - origin[axis]) * inv;
      const t2 = (aabb.max[axis] - origin[axis]) * inv;
      tNear = Math.max(tNear, Math.min(t1, t2));
      tFar = Math.min(tFar, Math.max(t1, t2));
    }
    if (tFar >= Math.max(tNear, 0)) result.add(i);
  });
  return result;
}

describe('shapeWorldAabb', () => {
  it('computes the world box for an identity transform', () => {
    const hash: ShapeHash = {
      modelIndex: 0,
      rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      translation: [10, 20, 30],
      size: [4, 6, 8],
      pos: [-2, -3, -4],
      atlasOffset: [0, 0, 0],
    };
    const aabb = shapeWorldAabb(hash);
    expect(aabb.min).toEqual([8, 17, 26]);
    expect(aabb.max).toEqual([12, 23, 34]);
  });

  it('handles 90-degree rotations (axis swap)', () => {
    // rotate 90° about z: x -> y, y -> -x (column-major columns: (0,1,0), (-1,0,0), (0,0,1))
    const hash: ShapeHash = {
      modelIndex: 0,
      rotation: [0, 1, 0, -1, 0, 0, 0, 0, 1],
      translation: [0, 0, 0],
      size: [4, 6, 8],
      pos: [0, 0, 0],
      atlasOffset: [0, 0, 0],
    };
    const aabb = shapeWorldAabb(hash);
    // extents (2,3,4) -> world (3,2,4) around rotated center (-3,2,4)
    expect(aabb.min).toEqual([-6, 0, 0]);
    expect(aabb.max).toEqual([0, 4, 8]);
  });
});

describe('buildShapeBvh', () => {
  it('single shape becomes a single leaf covering it', () => {
    const bvh = buildShapeBvh([box([0, 0, 0], [1, 2, 3])]);
    expect(bvh.nodeCount).toBe(1);
    expect(bvh.order).toEqual([0]);
    expect([...bvh.nodes.slice(0, 3)]).toEqual([0, 0, 0]);
    expect([...bvh.nodes.slice(4, 7)]).toEqual([1, 2, 3]);
    expect(bvh.nodes[3]).toBe(-1); // leaf at order start 0
    expect(bvh.nodes[7]).toBe(1); // count
  });

  it('order is a permutation of all shapes', () => {
    const rand = lcg(7);
    const aabbs: Aabb[] = [];
    for (let i = 0; i < 100; i++) {
      const x = rand() * 1000 - 500;
      const y = rand() * 100;
      const z = rand() * 1000 - 500;
      aabbs.push(box([x, y, z], [x + 10 + rand() * 50, y + 10, z + 10 + rand() * 50]));
    }
    const bvh = buildShapeBvh(aabbs);
    expect([...bvh.order].sort((a, b) => a - b)).toEqual(aabbs.map((_, i) => i));
  });

  it('traversal finds exactly the brute-force candidate set', () => {
    const rand = lcg(42);
    const aabbs: Aabb[] = [];
    for (let i = 0; i < 200; i++) {
      const x = rand() * 2000 - 1000;
      const y = rand() * 200 - 50;
      const z = rand() * 2000 - 1000;
      aabbs.push(box([x, y, z], [x + 5 + rand() * 100, y + 5 + rand() * 60, z + 5 + rand() * 100]));
    }
    const bvh = buildShapeBvh(aabbs);
    for (let trial = 0; trial < 200; trial++) {
      const origin: [number, number, number] = [
        rand() * 2400 - 1200,
        rand() * 400 - 100,
        rand() * 2400 - 1200,
      ];
      let dir: [number, number, number] = [rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1];
      const len = Math.hypot(...dir) || 1;
      dir = [dir[0] / len, dir[1] / len, dir[2] / len];
      expect(queryBvh(bvh, aabbs, origin, dir)).toEqual(bruteForce(aabbs, origin, dir));
    }
  });

  it('stays balanced (stack depth bound)', () => {
    // worst-ish case: collinear boxes
    const aabbs: Aabb[] = [];
    for (let i = 0; i < 1024; i++) aabbs.push(box([i * 10, 0, 0], [i * 10 + 5, 5, 5]));
    const bvh = buildShapeBvh(aabbs);
    // depth of a median-split tree over 1024 leaves-of-2 is ~10
    let maxDepth = 0;
    const walk = (node: number, depth: number) => {
      maxDepth = Math.max(maxDepth, depth);
      const a = bvh.nodes[node * 8 + 3];
      const b = bvh.nodes[node * 8 + 7];
      if (a >= 0) {
        walk(a, depth + 1);
        walk(b, depth + 1);
      }
    };
    walk(0, 1);
    expect(maxDepth).toBeLessThanOrEqual(12);
  });
});
