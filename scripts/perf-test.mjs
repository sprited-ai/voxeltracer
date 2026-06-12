// Measures trace throughput (ticks/sec) per backend on a small scene
// matrix. Requires the dev server on :5173 and a system Chrome.
//
// Usage: node scripts/perf-test.mjs [maxSteps]
import { chromium } from 'playwright-core';

const SCENES = [
  ['1 store', 'vox/pink_mini_store.vox'],
  ['256 stores', 'vox/generated/ministore_16x16.vox'],
  ['terrain 16 tiles', 'vox/generated/terrain_4x4.vox'],
];
const MAX_STEPS = parseInt(process.argv[2] ?? '240', 10);

const browser = await chromium.launch({ channel: 'chrome', headless: false });
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });

console.log(`maxSteps=${MAX_STEPS}, viewport 1024x768 dpr=1\n`);
console.log('scene'.padEnd(20), 'webgl2'.padEnd(12), 'webgpu');

for (const [label, scene] of SCENES) {
  const row = [label.padEnd(20)];
  for (const backend of ['webgl2', 'webgpu']) {
    await page.goto(
      `http://localhost:5173/?perf#src=${scene}&backend=${backend}&maxSteps=${MAX_STEPS}&dpr=1`,
      { waitUntil: 'domcontentloaded' }
    );
    await page.evaluate(() => {
      window.__vtDone = false;
      window.__vtStart = performance.now();
    });
    await page.waitForFunction(() => window.__vtDone === true, null, { timeout: 300_000 });
    const ms = await page.evaluate(() => performance.now() - window.__vtStart);
    row.push(`${((MAX_STEPS / ms) * 1000).toFixed(1)} tps`.padEnd(12));
  }
  console.log(row.join(''));
}

await browser.close();
