export interface AtlasPlacement {
  offset: [number, number, number];
}

export interface AtlasLayout {
  /** Dimensions of the 3D atlas texture. */
  size: [number, number, number];
  /** One placement per input size, in input order. */
  placements: AtlasPlacement[];
}

/**
 * Packs model boxes into a single 3D atlas using a shelf algorithm:
 * boxes fill a row along x, rows stack along y into a layer, layers
 * stack along z. Placements are returned in input order so they can be
 * indexed by model index.
 */
export function packAtlas(sizes: [number, number, number][], maxSize: number): AtlasLayout {
  const placements: AtlasPlacement[] = [];
  let x = 0;
  let y = 0;
  let z = 0;
  let rowDepthY = 0; // tallest box in the current row
  let layerDepthZ = 0; // deepest box in the current layer
  let atlasX = 0;
  let atlasY = 0;
  let atlasZ = 0;

  for (const [sx, sy, sz] of sizes) {
    if (sx > maxSize || sy > maxSize || sz > maxSize) {
      throw new Error(`Model size ${sx}x${sy}x${sz} exceeds the 3D texture limit (${maxSize})`);
    }
    if (x + sx > maxSize) {
      // new row
      x = 0;
      y += rowDepthY;
      rowDepthY = 0;
    }
    if (y + sy > maxSize) {
      // new layer
      x = 0;
      y = 0;
      z += layerDepthZ;
      rowDepthY = 0;
      layerDepthZ = 0;
    }
    if (z + sz > maxSize) {
      throw new Error(
        `Scene does not fit in a ${maxSize}^3 voxel atlas (${sizes.length} models)`
      );
    }
    placements.push({ offset: [x, y, z] });
    atlasX = Math.max(atlasX, x + sx);
    atlasY = Math.max(atlasY, y + sy);
    atlasZ = Math.max(atlasZ, z + sz);
    rowDepthY = Math.max(rowDepthY, sy);
    layerDepthZ = Math.max(layerDepthZ, sz);
    x += sx;
  }

  return { size: [Math.max(atlasX, 1), Math.max(atlasY, 1), Math.max(atlasZ, 1)], placements };
}
