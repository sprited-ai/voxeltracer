import ShapeHash from '../Types/ShapeHash';

export interface Aabb {
  min: [number, number, number];
  max: [number, number, number];
}

export interface ShapeBvh {
  /**
   * Flattened nodes, 8 floats (2 RGBA32F texels) per node:
   *   texel 0: aabbMin.xyz | A
   *   texel 1: aabbMax.xyz | B
   * Inner node: A = left child index (> 0), B = right child index.
   * Leaf:       A = -(shapeStart + 1),     B = shape count.
   * Leaf shape ranges index into the REORDERED shape list (`order`).
   */
  nodes: Float32Array;
  nodeCount: number;
  /** order[i] = index into the original shape array for reordered slot i */
  order: number[];
}

/** World-space AABB of a shape's box under its rigid transform. */
export function shapeWorldAabb(hash: ShapeHash): Aabb {
  const r = hash.rotation; // column-major 3x3
  const t = hash.translation;
  const center = [
    hash.pos[0] + hash.size[0] / 2,
    hash.pos[1] + hash.size[1] / 2,
    hash.pos[2] + hash.size[2] / 2,
  ];
  const extent = [hash.size[0] / 2, hash.size[1] / 2, hash.size[2] / 2];
  const min: [number, number, number] = [0, 0, 0];
  const max: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const worldCenter =
      r[i] * center[0] + r[i + 3] * center[1] + r[i + 6] * center[2] + t[i];
    const worldExtent =
      Math.abs(r[i]) * extent[0] + Math.abs(r[i + 3]) * extent[1] + Math.abs(r[i + 6]) * extent[2];
    min[i] = worldCenter - worldExtent;
    max[i] = worldCenter + worldExtent;
  }
  return { min, max };
}

const MAX_SHAPES_PER_LEAF = 2;

/**
 * Median-split BVH over shape AABBs. Balanced by construction, so traversal
 * stack depth is bounded by ~log2(n) + 1.
 */
export function buildShapeBvh(aabbs: Aabb[]): ShapeBvh {
  const nodes: number[] = [];
  const order: number[] = [];

  const centroid = (i: number, axis: number) => (aabbs[i].min[axis] + aabbs[i].max[axis]) / 2;

  function build(indices: number[]): number {
    const nodeIndex = nodes.length / 8;
    nodes.push(0, 0, 0, 0, 0, 0, 0, 0);

    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const i of indices) {
      for (let axis = 0; axis < 3; axis++) {
        min[axis] = Math.min(min[axis], aabbs[i].min[axis]);
        max[axis] = Math.max(max[axis], aabbs[i].max[axis]);
      }
    }

    let a: number;
    let b: number;
    if (indices.length <= MAX_SHAPES_PER_LEAF) {
      a = -(order.length + 1);
      b = indices.length;
      order.push(...indices);
    } else {
      const sizes = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
      const axis = sizes.indexOf(Math.max(...sizes));
      const sorted = [...indices].sort((x, y) => centroid(x, axis) - centroid(y, axis));
      const mid = sorted.length >> 1;
      a = build(sorted.slice(0, mid));
      b = build(sorted.slice(mid));
    }

    const base = nodeIndex * 8;
    nodes[base + 0] = min[0];
    nodes[base + 1] = min[1];
    nodes[base + 2] = min[2];
    nodes[base + 3] = a;
    nodes[base + 4] = max[0];
    nodes[base + 5] = max[1];
    nodes[base + 6] = max[2];
    nodes[base + 7] = b;
    return nodeIndex;
  }

  if (aabbs.length === 0) {
    return { nodes: new Float32Array(8), nodeCount: 1, order: [] };
  }
  build(aabbs.map((_, i) => i));
  return { nodes: Float32Array.from(nodes), nodeCount: nodes.length / 8, order };
}

function slabHit(
  min: ArrayLike<number>,
  max: ArrayLike<number>,
  minOffset: number,
  maxOffset: number,
  origin: ArrayLike<number>,
  dir: ArrayLike<number>
): boolean {
  let tNear = -Infinity;
  let tFar = Infinity;
  for (let axis = 0; axis < 3; axis++) {
    const inv = 1 / dir[axis];
    const t1 = (min[minOffset + axis] - origin[axis]) * inv;
    const t2 = (max[maxOffset + axis] - origin[axis]) * inv;
    tNear = Math.max(tNear, Math.min(t1, t2));
    tFar = Math.min(tFar, Math.max(t1, t2));
  }
  return tFar >= Math.max(tNear, 0);
}

/**
 * Reference traversal (mirrors the GLSL implementation, including the
 * per-shape box test that intersectShape performs inside a leaf) — returns
 * the set of ORIGINAL shape indices whose AABB the ray hits. Used by tests
 * to compare against brute force.
 */
export function queryBvh(
  bvh: ShapeBvh,
  aabbs: Aabb[],
  origin: [number, number, number],
  dir: [number, number, number]
): Set<number> {
  const result = new Set<number>();
  if (bvh.order.length === 0) return result;
  const stack = [0];
  while (stack.length > 0) {
    const node = stack.pop()!;
    const base = node * 8;
    if (!slabHit(bvh.nodes, bvh.nodes, base, base + 4, origin, dir)) continue;
    const a = bvh.nodes[base + 3];
    const b = bvh.nodes[base + 7];
    if (a < 0) {
      const start = -a - 1;
      for (let i = 0; i < b; i++) {
        const shapeIndex = bvh.order[start + i];
        const aabb = aabbs[shapeIndex];
        if (slabHit(aabb.min, aabb.max, 0, 0, origin, dir)) result.add(shapeIndex);
      }
    } else {
      stack.push(a, b);
    }
  }
  return result;
}
