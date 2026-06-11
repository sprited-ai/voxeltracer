# WebGL2 Modernization + Large-File Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move voxelviewer to a modern toolchain (Vite + TS5 + React 18 + three.js latest), replace gl-react with an owned WebGL2 render pass, and remove the scene-size limits (4096² packed texture, shape-count cap, fixed DDA bounds) so much larger .vox files render.

**Architecture:** The path tracer becomes a pure-TS `VoxelRenderer` class owning a three.js `WebGLRenderer`, two half-float ping-pong render targets, and its own rAF loop (React no longer re-renders per tick). Voxel data moves from a hand-packed 2D RGBA texture to an `R8UI` 3D atlas (`usampler3D` + `texelFetch`); shape metadata moves from a fixed uniform array to an RGBA32F data texture with a dynamic count. Shaders are consolidated into single GLSL ES 3.00 files imported via Vite `?raw` (glslify dropped).

**Tech Stack:** Vite 6, TypeScript 5, React 18, three.js (latest, r17x), vitest, Playwright/Chrome for visual verification.

**Context findings that motivate this plan:**
- `gl-react-dom@3.17.2` can never request a `webgl2` context (verified in published source).
- `src/Shaders/Constants/MAX_SHAPE_COUNT.glsl` is `1` — the current renderer only traces the **first** shape; multi-model scenes are silently truncated. Large-file support is partly a functionality *fix*, not just a limit raise.
- `EnhancedNode.tsx`'s Proxy hack (UNSIGNED_BYTE → HALF_FLOAT_OES) is *invalid* under WebGL2 (sized internal formats required), so the context can't simply be swapped.
- Per-tick `setState` in `VoxelViewer.tsx` re-renders React up to 1000 times per camera pose; the new renderer loop removes React from the hot path.

**Verification strategy (applies to every rendering task):**
- Golden screenshots of the *current* renderer are taken from the live gh-pages deployment (https://kndlt.github.io/voxelviewer) before any code changes — the old webpack-4 stack cannot run on modern node, so the deployed site is the reference.
- After the new renderer lands, screenshot the same scenes at the same default camera and compare visually (not pixel-exact: RNG and float-format changes shift noise, but geometry/materials/lighting must match).
- Scenes: `pink_mini_store.vox` (default), `multiple.vox` (multi-shape — expect a *difference*: old renders 1 shape, new renders all), `glass.vox`, `metal.vox`, `emit.vox`, `monu9.vox`.

---

## File Structure

```
vite.config.ts                          # create  — demo app build/dev
vite.lib.config.ts                      # create  — library build (replaces build-lib.js)
index.html                              # create  — Vite entry (from public/index.html)
src/main.tsx                            # create  — demo bootstrap (createRoot), replaces Components/App/index.tsx
src/index.tsx                           # modify  — library entry, createRoot API
src/Renderer/VoxelRenderer.ts           # create  — owns WebGLRenderer, ping-pong, rAF, tick, uniforms
src/Renderer/SceneTextures.ts           # create  — VoxelScene → GPU textures (3D atlas, shape tex, color/material tex)
src/Renderer/shaders/pathTracer.frag    # create  — consolidated ES 3.00 path tracer
src/Renderer/shaders/fullscreen.vert    # create  — fullscreen quad vertex shader
src/Renderer/shaders/display.frag      # create  — nearest copy-to-screen pass
src/Data/Packers/AtlasPacker.ts         # create  — 3D shelf packing of models into atlas
src/Data/Packers/AtlasPacker.test.ts    # create
src/Data/Packers/ScenePacker.ts         # delete  (after Task 8)
src/Data/Types/ShapeHash.ts             # modify  — byteOffset → atlasOffset [x,y,z]
src/Data/MagicaVoxel/*.test.ts          # create  — parser tests against generated fixtures
src/Components/VoxelViewer/VoxelViewer.tsx  # rewrite — thin React 18 wrapper around VoxelRenderer
src/Components/VoxelShader/             # delete  (gl-react wrapper + EnhancedNode)
src/Components/App/App.tsx              # rewrite — function component
src/Shaders/                            # delete  (after Task 8; content consolidated)
scripts/generate-vox.mjs                # create  — .vox generator (incl. nTRN/nGRP/nSHP scene graph)
scripts/{start,build,build-lib,test}.js # delete
config/                                 # delete
public/vox/generated/                   # create  — generated stress-test files
public/vox/web/                         # create  — CC0 samples downloaded from the web
package.json                            # rewrite — deps & scripts
```

Work happens on branch `jin/webgl2-modernize` off `master`.

---

### Task 0: Branch + golden captures

- [ ] Step 1: `git checkout master && git pull && git checkout -b jin/webgl2-modernize`
- [ ] Step 2: With browser tooling, load `https://kndlt.github.io/voxelviewer/#src=vox/<scene>` for each verification scene, wait for "Rendering Completed" or ≥300 ticks, screenshot to `docs/superpowers/plans/goldens/<scene>.png`.
- [ ] Step 3: Commit goldens.

### Task 1: Toolchain swap (Vite + TS5 + React 18 + three latest)

**Files:** `package.json`, `vite.config.ts`, `index.html`, `tsconfig.json`, `src/main.tsx`; delete `scripts/`, `config/`, `webpack.config.js`, `src/serviceWorker.ts`, `src/react-app-env.d.ts`.

- [ ] Step 1: Rewrite `package.json` deps. Runtime: `react@^18`, `react-dom@^18`, `three@latest`, `ndarray`, `qs`, `lodash` (verify usage; drop if unused). Dev: `vite`, `@vitejs/plugin-react`, `typescript@^5`, `vitest`, `@types/*` current, `gh-pages`. **Remove:** all babel/jest/eslint-5/webpack-4 packages, `gl-react`, `gl-react-dom`, `three-orbit-controls`, `react-timeout`, `react-animation-frame`, `glslify-loader`, `glsl-random`, `glsl-transpose`, `raw-loader`. Scripts: `dev: vite`, `build: vite build`, `build:lib: vite build -c vite.lib.config.ts`, `test: vitest run`, `preview: vite preview`. Remove `engines` pin.
- [ ] Step 2: `vite.config.ts` with `@vitejs/plugin-react`, `base: './'` (gh-pages), `assetsInclude` not needed (use `?raw` imports). `index.html` at root referencing `/src/main.tsx`.
- [ ] Step 3: Modern `tsconfig.json` (`target: ES2020`, `moduleResolution: bundler`, `strict: true` — keep existing laxness flags only if errors are unmanageable; prefer fixing).
- [ ] Step 4: `src/main.tsx`: `createRoot(document.getElementById('root')!).render(<App />)`.
- [ ] Step 5: Temporarily stub rendering: `VoxelViewer.tsx` keeps data loading but renders an empty `<canvas>` placeholder where `<Surface>` was (delete the gl-react import; component will be rewritten in Task 7). The point of this task is *the app boots under Vite*.
- [ ] Step 6: Fix TS5/three-upgrade compile errors in `src/Data/**` (mostly `OrbitControls` import → `three/examples/jsm/controls/OrbitControls`, `Matrix3.setFromMatrix4`, implicit-any). Run `yarn dev`, verify the app loads, dropdown works, loader parses (console), placeholder canvas shows.
- [ ] Step 7: Commit: `build: migrate to vite + ts5 + react18, stub renderer (non-rendering interim state)`.

### Task 2: Vitest + parser tests against in-memory fixtures

**Files:** `src/Data/MagicaVoxel/MagicaVoxelReader.test.ts`, helper `src/Data/MagicaVoxel/testFixtures.ts`; delete `src/Components/App/App.test.tsx`.

- [ ] Step 1: Write `buildVoxBytes()` fixture helper that assembles a valid VOX 150 buffer in-memory (header `VOX `+150, `MAIN` with `SIZE`+`XYZI`+`RGBA` children) for a 2×2×2 model with 3 voxels.
- [ ] Step 2: Failing test: reader parses fixture → 1 model, size (2,2,2), 3 voxels at expected indices, palette color 1 round-trips.
- [ ] Step 3: Run `yarn test` → fails (no test infra) → finish vitest config (`environment: 'node'` for data tests) → passes.
- [ ] Step 4: Add multi-model fixture test (2 SIZE/XYZI pairs + nTRN/nGRP/nSHP graph) asserting `VoxelScene.models.length === 2` and shape transforms.
- [ ] Step 5: Commit.

### Task 3: .vox generator + stress files

**Files:** `scripts/generate-vox.mjs`, output in `public/vox/generated/`.

- [ ] Step 1: Implement chunk writers (`SIZE`, `XYZI`, `RGBA`, `nTRN`, `nGRP`, `nSHP`, `MAIN` wrapper) — shared with Task 2 fixtures conceptually but standalone mjs (node, no TS).
- [ ] Step 2: Generators:
  - `sphere_256.vox` — hollow sphere shell, radius 120, in a 256³ model (~180k voxels).
  - `terrain_4x4.vox` — 16 models of 256×64×256 heightmap terrain placed in a 4×4 grid via scene graph (~1–2M surface voxels total; exceeds the old 1-shape renderer and exercises the multi-model path hard).
  - `many_models_100.vox` — 100 small (16³) varied-material models scattered via nTRN translations (exceeds old MAX_SHAPES=64 padding too).
- [ ] Step 3: Run generator; verify each file loads in MagicaVoxel-correct form via the Task-2 reader in a vitest case (`parses generated files without throwing, model counts match`).
- [ ] Step 4: Commit generator + files (check sizes; if any file >5MB, gitignore it and document the regen command instead).

### Task 4: AtlasPacker (3D shelf packing)

**Files:** `src/Data/Packers/AtlasPacker.ts`, `AtlasPacker.test.ts`.

Replaces the 1D byte-offset packing. Input: model sizes; output: per-model integer `[x,y,z]` offsets + atlas dimensions, fitting within `maxSize` (queried `MAX_3D_TEXTURE_SIZE` at runtime, 2048 typical, 256 guaranteed).

```ts
export interface AtlasPlacement { offset: [number, number, number]; }
export interface AtlasLayout { size: [number, number, number]; placements: AtlasPlacement[]; }

// Shelf algorithm: fill rows along x, rows stack along y into layers, layers stack along z.
export function packAtlas(sizes: [number, number, number][], maxSize: number): AtlasLayout
```

- [ ] Step 1: Failing tests: single model → offset (0,0,0), atlas == model size; two 8³ models → second at x=8; models overflow x → new y-row; overflow y → new z-layer; no two placements overlap (property check over the generated stress sizes); throws descriptive error when total cannot fit `maxSize³`.
- [ ] Step 2: Implement shelf packer (sort by height descending within insertion order kept stable for shape-index mapping — placements must be returned in input order).
- [ ] Step 3: Tests pass; commit.

### Task 5: SceneTextures (VoxelScene → GPU textures)

**Files:** `src/Renderer/SceneTextures.ts`, `SceneTextures.test.ts` (layout logic tested without GL), modify `src/Data/Types/ShapeHash.ts` (`byteOffset: number` → `atlasOffset: [number, number, number]`; keep the rest).

- [ ] Step 1: Pure function `buildAtlasData(models, layout): Uint8Array` writing each model's voxels into the 3D atlas array (`idx = (z * H + y) * W + x`, model-local `z*sy*sx + y*sx + x` source — same orientation as today). Failing test: voxel placed at model cell (1,0,1) of a model at atlas offset (8,0,0) lands at atlas (9,0,1).
- [ ] Step 2: Pure function `buildShapeTexData(shapeHashes): { data: Float32Array; count: number }` — 8 RGBA32F texels per shape, layout:
  - texel 0..2: rotation rows (`r00 r01 r02 | tx`, `r10 r11 r12 | ty`, `r20 r21 r22 | tz`) — translation in `.w`
  - texel 3: `size.xyz, 0`
  - texel 4: `pos.xyz, 0`
  - texel 5: `atlasOffset.xyz, 0`
  - texel 6–7: reserved (zeros)
  Test: known hash round-trips to expected floats.
- [ ] Step 3: GL-facing wrapper (not unit-tested) creating three textures:
  ```ts
  // voxel atlas
  const atlas = new THREE.Data3DTexture(data, W, H, D);
  atlas.format = THREE.RedIntegerFormat; atlas.type = THREE.UnsignedByteType;
  atlas.internalFormat = 'R8UI'; atlas.minFilter = atlas.magFilter = THREE.NearestFilter;
  atlas.unpackAlignment = 1; atlas.needsUpdate = true;
  // shapes
  const shapeTex = new THREE.DataTexture(f32, 8, count, THREE.RGBAFormat, THREE.FloatType);
  // colors / materials: 16×16 RGBA8 DataTexture from existing ndarrays (nearest, no flip)
  ```
- [ ] Step 4: Commit.

### Task 6: ES 3.00 shaders (consolidated)

**Files:** `src/Renderer/shaders/pathTracer.frag`, `fullscreen.vert`, `display.frag`. Content: the existing glslify modules concatenated and ported. Port rules (mechanical): `varying`→`in`, `texture2D`→`texture`/`texelFetch`, `gl_FragColor`→`out vec4 fragColor`, custom `mod(int,int)`→`%`, `glsl-transpose`→built-in `transpose()`, no `#version` line in file (three's `glslVersion: GLSL3` on RawShaderMaterial prepends it — verify at first compile; if not prepended, add manually).

Key new pieces (complete code):

```glsl
// voxel lookup — replaces voxelAt.glsl entirely
precision highp usampler3D;
uniform usampler3D voxelAtlas;
int voxelAt(ivec3 atlasOffset, ivec3 cellIndex) {
  return int(texelFetch(voxelAtlas, atlasOffset + cellIndex, 0).r);
}

// shape fetch — replaces uniform Shape shapes[N]
uniform sampler2D shapeTex;   // 8 x shapeCount RGBA32F
uniform int shapeCount;
Shape getShape(int i) {
  vec4 r0 = texelFetch(shapeTex, ivec2(0, i), 0);
  vec4 r1 = texelFetch(shapeTex, ivec2(1, i), 0);
  vec4 r2 = texelFetch(shapeTex, ivec2(2, i), 0);
  vec4 sz = texelFetch(shapeTex, ivec2(3, i), 0);
  vec4 ps = texelFetch(shapeTex, ivec2(4, i), 0);
  vec4 ao = texelFetch(shapeTex, ivec2(5, i), 0);
  // rows were packed; construct column-major mat3 via transpose of rows
  mat3 rot = transpose(mat3(r0.xyz, r1.xyz, r2.xyz));
  return Shape(rot, vec3(r0.w, r1.w, r2.w), ivec3(sz.xyz), ivec3(ps.xyz), ivec3(ao.xyz));
}
```

Loop changes:
- `intersectShapes`: `for (int i = 0; i < shapeCount; ++i)` (dynamic; `modelIndex == -1` sentinel and null-padding removed).
- `intersectShape` DDA: `int limit = shape.size.x + shape.size.y + shape.size.z + 3; for (int it = 0; it < limit; ++it)` — exact upper bound for a grid walk, no fixed 400.
- `getMaterial`: `texelFetch(colorTexture, ivec2(index % 16, index / 16), 0)` — y-flip and half-pixel UV math deleted (textures uploaded unflipped).
- Accumulation: `uniform sampler2D previousFrame;` + `texelFetch(previousFrame, ivec2(gl_FragCoord.xy), 0)`.
- `random.glsl` → PCG hash on `uvec3(gl_FragCoord.xy, tick)` (better convergence; ES 3.00 uint ops):
  ```glsl
  uint pcg(uint v) { v = v * 747796405u + 2891336453u; uint w = ((v >> ((v >> 28u) + 4u)) ^ v) * 277803737u; return (w >> 22u) ^ w; }
  float random(inout uint state) { state = pcg(state); return float(state) / 4294967296.0; }
  ```
  (Threading `inout uint state` through bounce/jitter call sites replaces the float-seed plumbing.)

- [ ] Step 1: Write `fullscreen.vert` (positions attribute → `uv` out) and `display.frag` (texelFetch copy).
- [ ] Step 2: Port/concatenate the path tracer per rules above, structs first, then functions in dependency order (random → intersectBoundingBox → voxelAt/getShape → intersectShape → intersectGround → intersectShapes → castShadow/castRay/jitter*/bounceRay/getMaterial → main). Behavior-preserving except: shape count dynamic, PRNG swap.
- [ ] Step 3: Compile check happens in Task 7 (no GL here); commit shaders with renderer skeleton compiling them.

### Task 7: VoxelRenderer + thin VoxelViewer

**Files:** `src/Renderer/VoxelRenderer.ts`, rewrite `src/Components/VoxelViewer/VoxelViewer.tsx`, delete `src/Components/VoxelShader/`.

`VoxelRenderer` (pure TS, no React):

```ts
export class VoxelRenderer {
  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, preserveDrawingBuffer: true });
    // two ping-pong accumulation targets
    const mkTarget = (w: number, h: number) => new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType, minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter, depthBuffer: false,
    });
    // fullscreen quad scene shared by trace & display passes (RawShaderMaterial, glslVersion: GLSL3)
  }
  setScene(scene: VoxelScene): void   // builds SceneTextures, resets tick
  setCamera(camera: PerspectiveCamera): void  // pulls eye/matrixWorld/projectionMatrixInverse, resets tick
  setSize(w: number, h: number, pixelRatio: number): void  // re-allocates targets, resets tick
  start(): void; stop(): void;        // rAF loop; per frame: trace pass (read prev, write next), swap, display pass to canvas
  onTick?: (tick: number, msElapsed: number) => void  // throttled UI callback (every 10 ticks)
  captureBlob(type?: string, quality?: number): Promise<Blob | null>
  dispose(): void
}
```

Loop per frame: set uniforms (`tick`, `previousFrame` = prevTarget.texture), render trace material into nextTarget, then display material (nextTarget.texture) to the default framebuffer, swap, `tick++`, stop at `maxTick` (1000, or `maxSteps` option) and fire `onRendered`.

`VoxelViewer.tsx` becomes a function component: hosts `<canvas ref>`, instantiates `VoxelRenderer` + `OrbitControls` (from `three/examples/jsm/controls/OrbitControls`) in `useEffect`, loads `src` via existing `Loader`, wires orbit `change` → `setCamera` (with the existing 100ms pause-debounce behavior), resize observer → `setSize`, status panel driven by `onTick` state at 10-tick granularity. Keeps the dropdown/status UI as today.

- [ ] Step 1: Implement renderer; `yarn dev`; iterate on shader compile errors until `pink_mini_store.vox` renders and accumulates.
- [ ] Step 2: Verify against goldens: pink_mini_store, glass, metal, emit, monu9 visually match; `multiple.vox` now shows **all** shapes (expected improvement over golden — note it in the commit).
- [ ] Step 3: Check console for GL errors/warnings; check accumulation restarts on orbit + resize.
- [ ] Step 4: Commit: `feat: WebGL2 path tracer (owned three.js pass), replaces gl-react`.

### Task 8: Large-file stress + cleanup

- [ ] Step 1: Load `generated/sphere_256.vox`, `generated/terrain_4x4.vox`, `generated/many_models_100.vox` in the dev app; all must render (this exercises >64 shapes, multi-model atlas, big DDA walks). Screenshot each into the verification set.
- [ ] Step 2: Delete dead code: `src/Shaders/`, `src/Components/VoxelShader/`, `src/Data/Packers/ScenePacker.ts`, remaining CRA remnants. `grep -r "gl-react\|glslify\|ScenePacker"` → no hits outside docs.
- [ ] Step 3: Run `yarn test` (all green) + `yarn build` (app) — commit.

### Task 9: Library build + API parity

**Files:** `vite.lib.config.ts`, `src/index.tsx`.

- [ ] Step 1: `src/index.tsx`: port `initVoxelViewer` to `createRoot` (root stored for `rerender`/unmount); keep `captureAsBlob`/`captureAndDownload`/`captureAndSetAsInputFile`/`getCanvas`/`rerender` signatures unchanged (capture functions can keep reading the canvas — `preserveDrawingBuffer: true` is set).
- [ ] Step 2: `vite.lib.config.ts`: `build.lib = { entry: 'src/index.tsx', name: 'voxelviewer', formats: ['es', 'umd'] }`, externalize nothing (standalone bundle, as before) or externalize react — match previous UMD behavior (bundled). `package.json` `main`/`module`/`types` updated to Vite output names; add `vite-plugin-dts` for `index.d.ts`.
- [ ] Step 3: `yarn build:lib`; smoke-test the UMD bundle in a bare HTML page (script tag + `voxelviewer.initVoxelViewer({src, container})` against a sample .vox served from public/).
- [ ] Step 4: Commit.

### Task 10: Web samples + final verification + docs

- [ ] Step 1: Download a handful of CC0 .vox models (mikelovesrobots/mmmm collection on GitHub is CC0) into `public/vox/web/`, add to the App dropdown list, load each in the dev app and screenshot.
- [ ] Step 2: Full pass over the verification matrix (goldens + generated + web files); fix anything off.
- [ ] Step 3: Update `README.md` (dev commands, WebGL2 requirement, generator usage) and append a status note to `docs/webgl2-upgrade.md`.
- [ ] Step 4: Commit, push branch, open PR with before/after screenshots.

---

## Self-Review Notes

- Spec coverage: toolchain (T1), gl-react removal/WebGL2 pass (T6–7), shader port (T6), 4096²→3D atlas (T4–5), shape-count cap→dynamic texture (T5–6), DDA bound (T6), library parity (T9), web/generated .vox testing (T3, T8, T10), goldens (T0). Doc Phase 4 PRNG included in T6.
- Known judgment calls recorded: shaders consolidated rather than `#include`-modular (they form one program; glslify was tooling-driven); shapes in RGBA32F texture rather than UBO (no std140 padding, no 16KB guarantee ceiling); React stays for the component shell but is out of the per-tick path.
- Interim non-rendering state exists between T1 and T7 commits — acceptable on a feature branch; goldens protect the end state.
