import { describe, it, expect } from 'vitest';
import { buildVox } from '../../scripts/voxBuilder.mjs';
import MagicaVoxelContext from '../Data/MagicaVoxel/MagicaVoxelContext';
import { computeSceneBounds } from './sceneBounds';

describe('computeSceneBounds', () => {
  it('covers all instances of a translated multi-model scene', () => {
    const bytes = buildVox({
      models: [
        { size: [4, 4, 4], voxels: [[0, 0, 0, 1]] },
        { size: [4, 4, 4], voxels: [[0, 0, 0, 1]] },
      ],
      translations: [
        [-20, 0, 2],
        [20, 0, 2],
      ],
    });
    const scene = new MagicaVoxelContext().parseScene(bytes.buffer);
    const bounds = computeSceneBounds(scene);
    // models are 4 wide, centers at GL x = -20 and +20
    expect(bounds.min.x).toBe(-22);
    expect(bounds.max.x).toBe(22);
  });
});
