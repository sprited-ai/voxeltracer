import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import MagicaVoxelContext from './MagicaVoxelContext';

// Regenerate with: node scripts/generate-vox.mjs
const dir = join(__dirname, '../../../public/vox/generated');

function parseFile(name: string) {
  const buf = readFileSync(join(dir, name));
  const bytes = new Uint8Array(buf).slice();
  return new MagicaVoxelContext().parseScene(bytes.buffer);
}

describe('generated stress files', () => {
  it('sphere_256.vox: one 256-cube model', () => {
    const scene = parseFile('sphere_256.vox');
    expect(scene.models).toHaveLength(1);
    expect([scene.models[0].size.x, scene.models[0].size.y, scene.models[0].size.z]).toEqual([
      256, 256, 256,
    ]);
  });

  it('terrain_4x4.vox: 16 tiles whose volume exceeds the legacy 67M-cell cap', () => {
    const scene = parseFile('terrain_4x4.vox');
    expect(scene.models).toHaveLength(16);
    const volume = scene.models.reduce((v, m) => v + m.size.x * m.size.y * m.size.z, 0);
    expect(volume).toBeGreaterThan(4096 * 4096 * 4);
  });

  it('many_models_100.vox: 100 shapes', () => {
    const scene = parseFile('many_models_100.vox');
    expect(scene.models).toHaveLength(100);
    expect(scene.rootObj.children).toHaveLength(100);
  });
});
