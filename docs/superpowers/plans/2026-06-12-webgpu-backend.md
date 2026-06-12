# WebGPU Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a WebGPU rendering mode (compute-shader path tracer) with
automatic downgrade to the existing WebGL2 backend when WebGPU is
unavailable.

**Architecture:** Extract a `TraceBackend` interface from `VoxelRenderer`;
the orchestrator (rAF loop, sub-step controller, tick accounting,
callbacks) stays backend-neutral. The WebGL2 backend is the current
three.js code moved behind the interface. The WebGPU backend is raw WebGPU
(no three.js): the path tracer runs as a **compute shader** writing to a
ping-pong rgba16float storage texture, presented by a trivial fullscreen
render pass. Compute-first keeps the kernel portable to Node (Dawn
bindings) and Cloudflare Workers (compute-only WebGPU), per
docs/webgl2-upgrade.md §7.

**Why compute, not fragment:** we never needed the raster pipeline — the
fullscreen quad is a WebGL2 workaround for not having compute. Compute
also unlocks workgroup-local BVH stacks / wavefront scheduling later.

**Data mapping (data layer unchanged — parser/atlas/BVH/light list all
renderer-agnostic):**

| WebGL2 today | WebGPU |
|---|---|
| R8UI 3D texture atlas | `texture_3d<u32>` (r8uint), `textureLoad` |
| shapeTex RGBA32F (8 texels/shape) | storage buffer `array<vec4f>`, same packed layout |
| bvhTex RGBA32F (2 texels/node) | storage buffer `array<vec4f>`, same layout |
| lightTex RGBA32F | storage buffer `array<vec4f>` |
| color/material 16x16 RGBA8 | storage buffer `array<vec4f>` (256 entries, pre-normalized floats) |
| half-float ping-pong render targets | rgba16float storage textures (read in next pass via textureLoad) |
| uniforms | one uniform buffer struct (camera mats, tick, counts, flags) |

Reusing the packed vec4 layouts (instead of proper WGSL structs) keeps the
TS upload code shared and the WGSL helpers line-for-line comparable to the
GLSL (`getShape`, BVH traversal, `getMaterial`).

**Backend selection:** `createVoxelTracer({ backend: 'auto' | 'webgpu' |
'webgl2' })`, default `auto` = `navigator.gpu` exists AND
`requestAdapter()` resolves → WebGPU, else WebGL2. Init is async
(requestDevice); `createVoxelTracer` stays sync — it queues `load()`
behind an internal `backendReady` promise. The debug panel shows the
active backend. `tracer.renderer.backendKind` exposed.

**Verification:** no GPU in vitest — parity is verified in-browser:
same scene + same tick count on both backends must match visually
(goldens: pink_mini_store, glass, metal, emit, monu9, multiple, lamps
with NEE on/off). Perf table re-measured on both.

---

### Task 1: Extract TraceBackend interface (pure refactor)

**Files:** create `src/Renderer/TraceBackend.ts` (interface + shared types:
CameraState, BackendOptions), create `src/Renderer/WebGL2Backend.ts`
(current GPU code moved), modify `src/Renderer/VoxelRenderer.ts`
(orchestrator only: loop, sub-step, ticksPerSecond, onTick/onRendered,
emissiveSampling passthrough).

- [ ] Interface: `init(): Promise<void>`, `setScene(scene)`, `setCamera(camera)`,
      `setSize(w, h)` (device px), `renderTicks(startTick, count)` (trace+present),
      `set emissiveSampling/maxTick`, `captureBlob`, `dispose`, `readonly kind`.
- [ ] VoxelRenderer keeps its public API identical (compat for createVoxelTracer
      and the React app); constructor takes `backend?: 'auto'|'webgpu'|'webgl2'`.
- [ ] WebGL2 path behaves byte-identically; verify pink_mini_store + lamps in
      browser. Tests/typecheck green. Commit.

### Task 2: Backend auto-detection + WebGPU skeleton

**Files:** create `src/Renderer/WebGPUBackend.ts`, modify
`src/core/createVoxelTracer.ts` (backend option, async ready queue),
`src/Components/VoxelViewer/VoxelViewer.tsx` (debug panel shows backend).

- [ ] requestAdapter/requestDevice; canvas `getContext('webgpu')`,
      preferred format; on any failure → throw, orchestrator falls back to
      WebGL2 and records the reason (debug panel shows `webgl2 (fallback: …)`).
- [ ] Skeleton presents a solid color so the wiring is visible. Commit.

### Task 3: Scene resources upload

- [ ] `texture_3d<u32>` atlas (writeTexture, bytesPerRow alignment 256 —
      pad rows when atlas width not multiple of 256).
- [ ] Storage buffers: shapes/bvh/lights from the existing Float32Array
      builders; palette/materials converted once to Float32Array (÷255).
- [ ] Uniform buffer struct (mat4 viewMatrixInverse, mat4 projectionMatrixInverse,
      vec4 eye, vec4 lightDir, vec4 sky/ground/light colors, ivec sizes, tick,
      maxTick, shapeCount, lightCount, neeEnabled, resolution).
- [ ] Bind group layout: uniforms, atlas, shapes, bvh, lights, palette,
      materials, accumRead (texture_2d), accumWrite (storage texture). Commit.

### Task 4: WGSL kernel port

**File:** `src/Renderer/shaders/pathTracer.wgsl` (compute, @workgroup_size(8,8))
plus `present.wgsl` (fullscreen triangle + sample accum).

Port rules GLSL→WGSL: struct syntax, `var`/`let`, `textureLoad(atlas, pos, 0).r`,
arrays `array<i32, 32>` for the BVH stack, `select()` for ternaries where
needed, same PCG (u32 ops identical), loop bounds identical. Keep the
metal double-diffuse quirk, frame-coherent seeding (per-tick uniform),
per-pixel decorrelated NEE light pick, MIS weights — all exactly as GLSL.

- [ ] Port in dependency order (structs → rng → intersect → BVH traversal →
      materials → NEE → main), compile-check via device.pushErrorScope.
- [ ] Accumulation blend identical: `mix(prev, new, 1/(effectiveTick+1))`.
- [ ] pink_mini_store renders and converges; then golden sweep (glass, metal,
      emit, monu9, multiple, lamps NEE on/off) side-by-side vs WebGL2. Commit.

### Task 5: Parity, perf, ship

- [ ] Sub-step controller works on WebGPU (same rAF-delta signal).
- [ ] Perf table: both backends on ministore grids + terrain (expect WebGPU ≥
      WebGL2; document in §7 of webgl2-upgrade.md as "status update").
- [ ] captureBlob works (canvas toBlob is backend-agnostic).
- [ ] README: backend option; debug panel: backend line.
- [ ] Version 1.2.0, tag push → CI trusted publish, deploy demo, release notes.

**Risks:** bytesPerRow=256 alignment for r8uint atlas upload (pad or use
COPY_DST via staging buffer); rgba16float storage write support is
universal in WebGPU (no extension needed); Safari WebGPU quirks — verify
in Chrome first, Safari is fallback-eligible by design.
