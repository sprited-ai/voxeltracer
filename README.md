# VoxelTracer

MagicaVoxel path tracer for the web. Renders `.vox` files with a progressive
monte-carlo path tracer on WebGL2 — voxel data lives in an `R8UI` 3D texture
atlas walked by a DDA kernel, with diffuse/metal/glass/emissive materials and
soft shadows. Framework-agnostic library plus a React demo app.

Demo: https://kndlt.github.io/voxeltracer

## Usage

### Script tag (UMD)

```html
<div id="app" style="width: 100%; height: 100%"></div>
<script src="voxeltracer.umd.cjs"></script>
<script>
  const tracer = voxeltracer.createVoxelTracer({
    container: document.getElementById('app'),
    src: 'model.vox',
  });
</script>
```

### npm (ESM)

```ts
import { createVoxelTracer } from 'voxeltracer';

const tracer = createVoxelTracer({
  container: document.getElementById('app')!,
  src: 'model.vox',                 // URL or File
  maxSteps: 1000,                   // accumulation budget
  onRendered: () => console.log('converged'),
});

await tracer.load(otherFile);       // swap scenes
const jpeg = await tracer.captureAsBlob();
tracer.dispose();
```

The tracer creates its own canvas inside `container`, wires orbit controls and
resize handling, and runs its own render loop. WebGL2 is required (universal
in browsers since 2021).

## Development

```
npm install
npm run dev        # demo app at http://localhost:5173
npm test           # vitest (parser, packers, texture layout)
npm run build      # demo app -> build/
npm run build:lib  # library -> dist/ (ESM + UMD + d.ts)
node scripts/generate-vox.mjs  # regenerate stress-test .vox files
```

Sample files live in `public/vox/` — including generated stress scenes
(`generated/`: a 256³ sphere, a 16-model 100M-cell terrain, a 100-model
scene) and CC0 models from [mikelovesrobots/mmmm](https://github.com/mikelovesrobots/mmmm)
(`web/`).

## Architecture notes

- `src/core/createVoxelTracer.ts` — public entry; canvas + controls + loop wiring
- `src/Renderer/VoxelRenderer.ts` — three.js WebGL2 pass: half-float ping-pong
  accumulation, trace + display passes
- `src/Renderer/shaders/pathTracer.frag` — GLSL ES 3.00 kernel (DDA voxel
  raymarch, dynamic shape count, PCG RNG)
- `src/Data/` — MagicaVoxel chunk parser (`.vox` versions with and without
  scene graphs), 3D atlas packer, material/palette arrays
- `docs/webgl2-upgrade.md` — the WebGL1→WebGL2 migration assessment this
  rewrite followed, including a WebGPU appendix

## License

MIT
