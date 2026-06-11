// Generates stress-test .vox files into public/vox/generated/.
// Usage: node scripts/generate-vox.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildVox } from './voxBuilder.mjs';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'vox', 'generated');
mkdirSync(outDir, { recursive: true });

function write(name, bytes) {
  const path = join(outDir, name);
  writeFileSync(path, bytes);
  console.log(`${name}: ${(bytes.length / 1024 / 1024).toFixed(2)} MB`);
}

// Small deterministic palette: gradient + a few material slots.
const palette = [];
for (let i = 0; i < 255; i++) {
  palette.push([64 + ((i * 3) % 192), 96 + ((i * 7) % 160), 128 + ((i * 11) % 128), 255]);
}

// ---------------------------------------------------------------------------
// sphere_256.vox — one 256^3 model, hollow sphere shell (~360k voxels).
// Exercises large single-model DDA walks (size 256 per axis).
{
  const voxels = [];
  const c = 127.5;
  const r = 120;
  for (let z = 0; z < 256; z++) {
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const d = Math.sqrt((x - c) ** 2 + (y - c) ** 2 + (z - c) ** 2);
        if (d >= r - 1 && d < r + 1) {
          // color bands by latitude
          voxels.push([x, y, z, 1 + (Math.floor(z / 16) % 250)]);
        }
      }
    }
  }
  write(
    'sphere_256.vox',
    buildVox({
      models: [{ size: [256, 256, 256], voxels }],
      translations: [[0, 0, 128]],
      palette,
    })
  );
}

// ---------------------------------------------------------------------------
// terrain_4x4.vox — 16 models of 256x256x96, 1-voxel-thick heightmap shell,
// placed in a 4x4 grid via the scene graph. Total model volume is
// 16 * 256 * 256 * 96 = 100,663,296 voxel cells, which exceeds the legacy
// renderer's 4096^2*4 = 67,108,864 packed-texture capacity.
{
  const models = [];
  const translations = [];
  const tiles = 4;
  const sx = 256;
  const sy = 256;
  const sz = 96;
  const height = (gx, gy) =>
    Math.max(
      1,
      Math.min(
        sz - 1,
        Math.round(40 + 25 * Math.sin(gx / 37) * Math.cos(gy / 29) + 12 * Math.sin(gx / 11 + gy / 13))
      )
    );
  for (let ty = 0; ty < tiles; ty++) {
    for (let tx = 0; tx < tiles; tx++) {
      const voxels = [];
      for (let y = 0; y < sy; y++) {
        for (let x = 0; x < sx; x++) {
          const h = height(tx * sx + x, ty * sy + y);
          voxels.push([x, y, h, 1 + (h % 250)]);
        }
      }
      models.push({ size: [sx, sy, sz], voxels });
      // translations position model centers; offset grid around the origin
      translations.push([(tx - tiles / 2) * sx + sx / 2, (ty - tiles / 2) * sy + sy / 2, sz / 2]);
    }
  }
  write('terrain_4x4.vox', buildVox({ models, translations, palette }));
}

// ---------------------------------------------------------------------------
// many_models_100.vox — 100 small 16^3 models scattered on a spiral.
// Exceeds both the legacy shader's shape loop (1) and the legacy
// MAX_SHAPES uniform padding (64).
{
  const models = [];
  const translations = [];
  const materials = [];
  for (let i = 0; i < 100; i++) {
    const voxels = [];
    const colorIndex = 1 + (i * 2) % 250;
    for (let z = 0; z < 16; z++) {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const onShell = x === 0 || x === 15 || y === 0 || y === 15 || z === 0 || z === 15;
          if (onShell) voxels.push([x, y, z, colorIndex]);
        }
      }
    }
    models.push({ size: [16, 16, 16], voxels });
    const angle = i * 0.35;
    const radius = 20 + i * 1.8;
    translations.push([
      Math.round(Math.cos(angle) * radius),
      Math.round(Math.sin(angle) * radius),
      8 + (i % 5) * 18,
    ]);
  }
  // sprinkle materials over the used palette range
  materials.push([3, { _type: '_metal', _metal: '0.9', _rough: '0.1', _spec: '0.7' }]);
  materials.push([5, { _type: '_glass', _alpha: '0.7', _rough: '0.05', _ior: '0.3' }]);
  materials.push([7, { _type: '_emit', _emit: '0.8', _flux: '0.6', _glow: '1' }]);
  write('many_models_100.vox', buildVox({ models, translations, palette, materials }));
}
