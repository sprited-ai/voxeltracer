// Golden screenshot tests: renders a scene matrix at a fixed tick count on
// both backends and compares raw canvas pixels against stored goldens.
// The renderer is deterministic (same ticks -> same image), so this both
// catches regressions and proves WebGL2 <-> WebGPU parity.
//
// Usage:
//   node scripts/golden-test.mjs               # compare both backends vs goldens
//   node scripts/golden-test.mjs --update      # (re)write goldens from webgl2
//   node scripts/golden-test.mjs --backend webgpu
//
// Requires the dev server on :5173 and a system Chrome (playwright-core,
// channel chrome — no browser download).
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const goldenDir = join(root, 'test-goldens');
const resultDir = join(root, 'test-results');
mkdirSync(goldenDir, { recursive: true });
mkdirSync(resultDir, { recursive: true });

const SCENES = [
  'vox/pink_mini_store.vox',
  'vox/glass.vox',
  'vox/metal.vox',
  'vox/emit.vox',
  'vox/multiple.vox',
  'vox/generated/lamps.vox',
  'vox/generated/ministore_2x2.vox',
];
const MAX_STEPS = 64;
const WIDTH = 640;
const HEIGHT = 480;
// mean abs diff per channel (0..255); rerun on the same backend is ~0,
// cross-backend differs only by float rounding
const MEAN_TOLERANCE = 1.5;

const args = process.argv.slice(2);
const update = args.includes('--update');
const backendArg = args.includes('--backend') ? args[args.indexOf('--backend') + 1] : null;
const backends = update ? ['webgl2'] : backendArg ? [backendArg] : ['webgl2', 'webgpu'];

function sceneId(scene) {
  return scene.replace(/[^a-z0-9]+/gi, '_').replace(/_vox$/, '');
}

async function captureScene(page, scene, backend) {
  const hash = `src=${scene}&backend=${backend}&maxSteps=${MAX_STEPS}&dpr=1`;
  await page.goto(`http://localhost:5173/?golden#${hash}`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    window.__vtDone = false;
  });
  await page.waitForFunction(() => window.__vtDone === true, null, { timeout: 60_000 });
  // Raw RGBA via toDataURL -> Image -> 2D canvas. Chrome's direct
  // drawImage(webgpuCanvas) reads back black; the (lossless) PNG round
  // trip works on both backends.
  const base64 = await page.evaluate(async () => {
    const src = document.querySelector('canvas');
    const url = src.toDataURL('image/png');
    const img = new Image();
    img.src = url;
    await img.decode();
    const copy = document.createElement('canvas');
    copy.width = src.width;
    copy.height = src.height;
    const ctx = copy.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, copy.width, copy.height).data;
    let binary = '';
    const bytes = new Uint8Array(data.buffer);
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  });
  return Buffer.from(base64, 'base64');
}

function diffStats(a, b) {
  if (a.length !== b.length) return { mean: Infinity, max: 255 };
  let sum = 0;
  let max = 0;
  for (let i = 0; i < a.length; i++) {
    if ((i & 3) === 3) continue; // skip alpha
    const d = Math.abs(a[i] - b[i]);
    sum += d;
    if (d > max) max = d;
  }
  return { mean: sum / ((a.length / 4) * 3), max };
}

const browser = await chromium.launch({
  channel: 'chrome',
  headless: false,
  args: ['--window-size=900,700'],
});
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });

let failures = 0;
for (const backend of backends) {
  for (const scene of SCENES) {
    const id = sceneId(scene);
    const goldenPath = join(goldenDir, `${id}.rgba.gz`);
    let pixels;
    try {
      pixels = await captureScene(page, scene, backend);
    } catch (e) {
      console.log(`FAIL  ${backend}  ${id}  (capture: ${e.message.split('\n')[0]})`);
      failures++;
      continue;
    }

    if (update) {
      const packed = gzipSync(pixels);
      writeFileSync(goldenPath, packed);
      console.log(`WROTE ${id} (${packed.length} bytes gz)`);
      continue;
    }

    if (!existsSync(goldenPath)) {
      console.log(`SKIP  ${backend}  ${id}  (no golden — run with --update first)`);
      continue;
    }
    const golden = gunzipSync(readFileSync(goldenPath));
    const { mean, max } = diffStats(golden, pixels);
    const ok = mean <= MEAN_TOLERANCE;
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  ${backend.padEnd(6)}  ${id.padEnd(28)}  mean=${mean.toFixed(3)} max=${max}`
    );
    if (!ok) {
      writeFileSync(join(resultDir, `${id}.${backend}.rgba`), pixels);
      failures++;
    }
  }
}

await browser.close();
if (failures > 0) {
  console.log(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log('\nall green');
