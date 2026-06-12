import{t as e}from"./index-BUjkQBhm.js";var t=`// WGSL compute path tracer — a line-for-line port of pathTracer.frag
// (GLSL ES 3.00). One invocation per pixel; accumulation ping-pongs between
// two rgba16float textures. Data lives in storage buffers using the same
// packed vec4 layouts as the WebGL2 texture encodings, so the fetch helpers
// stay comparable across backends.

struct Uniforms {
  viewMatrixInverse: mat4x4f,
  projectionMatrixInverse: mat4x4f,
  eye: vec4f,
  lightDir: vec4f,
  lightColor: vec4f,
  skyColor: vec4f,
  groundColor: vec4f,
  resolutionX: i32,
  resolutionY: i32,
  tick: i32,
  maxTick: i32,
  shapeCount: i32,
  lightCount: i32,
  neeEnabled: i32,
  pad0: i32,
}

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var voxelAtlas: texture_3d<u32>;
@group(0) @binding(2) var<storage, read> shapes: array<vec4f>; // 8 vec4 per shape
@group(0) @binding(3) var<storage, read> bvh: array<vec4f>; // 2 vec4 per node
@group(0) @binding(4) var<storage, read> lights: array<vec4f>; // xyz + material index
@group(0) @binding(5) var<storage, read> palette: array<vec4f>; // 256, normalized rgba
@group(0) @binding(6) var<storage, read> materials: array<vec4f>; // 256, raw byte values
@group(0) @binding(7) var prevFrame: texture_2d<f32>;
@group(0) @binding(8) var outFrame: texture_storage_2d<rgba16float, write>;

// ---------------------------------------------------------------- structs

struct Ray {
  origin: vec3f,
  dir: vec3f,
}

struct Hit {
  didHit: bool,
  t: f32,
  pos: vec3f,
  normal: vec3f,
  materialIndex: i32,
}

struct Material {
  mtype: i32,
  color: vec4f,
  weight: f32,
  roughness: f32,
  specular: f32,
  refraction: f32,
  flux: f32,
  glow: f32,
}

struct Shape {
  rotation: mat3x3f,
  translation: vec3f,
  size: vec3i,
  pivot: vec3i,
  atlasOffset: vec3i,
}

// -------------------------------------------------------------- constants

const MATL_DIFFUSE: i32 = 0;
const MATL_METAL: i32 = 1;
const MATL_GLASS: i32 = 2;
const MATL_EMISSIVE: i32 = 3;
const GROUND_MATERIAL_INDEX: i32 = 0;
const BOUNCE_LIMIT: i32 = 2;
const EPSILON: f32 = 0.0001;
const PI: f32 = 3.141592653589793;

const MISS = Hit(false, 0.0, vec3f(0.0), vec3f(0.0), 0);

// -------------------------------------------------------------------- rng

var<private> rngState: u32;
var<private> gPixel: vec2u;
// Whether the most recent bounce was specular (mirror/refraction). NEE only
// covers diffuse transport, so emitter hits after a specular bounce must
// still add their emission term.
var<private> gBounceSpecular: bool = false;
// Solid-angle pdf of the most recent diffuse bounce direction (cos/pi),
// used for MIS weighting against the light-sample pdf.
var<private> gBouncePdf: f32 = 0.0;

fn pcg(v: u32) -> u32 {
  let s = v * 747796405u + 2891336453u;
  let w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}

fn rand() -> f32 {
  rngState = pcg(rngState);
  return f32(rngState) / 4294967296.0;
}

fn uniformlyRandomDirection() -> vec3f {
  let u1 = rand();
  let v1 = rand();
  let z = 1.0 - 2.0 * u1;
  let r = sqrt(1.0 - z * z);
  let angle = 6.283185307179586 * v1;
  return vec3f(r * cos(angle), r * sin(angle), z);
}

fn uniformlyRandomVector() -> vec3f {
  return uniformlyRandomDirection() * sqrt(rand());
}

/** Cosine weighted direction (rorydriscoll.com/2009/01/07/better-sampling) */
fn cosineWeightedDirection(normal: vec3f) -> vec3f {
  let u1 = rand();
  let v1 = rand();
  let r = sqrt(u1);
  let angle = 6.283185307179586 * v1;
  var sdir: vec3f;
  if (abs(normal.x) < 0.5) {
    sdir = cross(normal, vec3f(1.0, 0.0, 0.0));
  } else {
    sdir = cross(normal, vec3f(0.0, 1.0, 0.0));
  }
  let tdir = cross(normal, sdir);
  return r * cos(angle) * sdir + r * sin(angle) * tdir + sqrt(1.0 - u1) * normal;
}

// -------------------------------------------------------------- functions

fn castRay(rayUV: vec2f) -> Ray {
  let q = u.viewMatrixInverse * u.projectionMatrixInverse * vec4f((rayUV - 0.5) * 2.0, 1.0, 1.0);
  let rayDirection = normalize(q.xyz / q.w - u.eye.xyz);
  return Ray(u.eye.xyz, rayDirection);
}

fn intersectBoundingBox(ray: Ray, boxMin: vec3f, boxMax: vec3f) -> vec2f {
  let tMin = (boxMin - ray.origin) / ray.dir;
  let tMax = (boxMax - ray.origin) / ray.dir;
  let t1 = min(tMin, tMax);
  let t2 = max(tMin, tMax);
  let tNear = max(max(t1.x, t1.y), t1.z);
  let tFar = min(min(t2.x, t2.y), t2.z);
  return vec2f(tNear, tFar);
}

fn getShape(i: i32) -> Shape {
  let base = i * 8;
  let r0 = shapes[base];
  let r1 = shapes[base + 1];
  let r2 = shapes[base + 2];
  let sz = shapes[base + 3];
  let ps = shapes[base + 4];
  let ao = shapes[base + 5];
  // texels hold matrix rows; mat3x3(col, col, col) + transpose restores M
  let rot = transpose(mat3x3f(r0.xyz, r1.xyz, r2.xyz));
  return Shape(rot, vec3f(r0.w, r1.w, r2.w), vec3i(sz.xyz), vec3i(ps.xyz), vec3i(ao.xyz));
}

fn voxelAt(shape: Shape, cellIndex: vec3i) -> i32 {
  return i32(textureLoad(voxelAtlas, shape.atlasOffset + cellIndex, 0).r);
}

fn intersectShape(rayIn: Ray, shape: Shape, mediumIndex: i32) -> Hit {
  let boxMin = vec3f(shape.pivot);
  let boxMax = vec3f(shape.pivot + shape.size);

  let originalRay = rayIn;

  // Transform ray using inverse model transformation.
  // Model = Translation * Rotation; inverse(Rotation) = transpose(Rotation).
  let inverseRotation = transpose(shape.rotation);
  var ray: Ray;
  ray.dir = inverseRotation * rayIn.dir;
  ray.origin = inverseRotation * (rayIn.origin - shape.translation);

  // Exactly-zero direction components make the DDA math produce NaN
  // (1/0 * sign(0) = inf * 0), which poisons the accumulation buffer
  // forever — seen as permanent black speckles. Nudge them off zero.
  if (abs(ray.dir.x) < 1e-8) { ray.dir.x = 1e-8; }
  if (abs(ray.dir.y) < 1e-8) { ray.dir.y = 1e-8; }
  if (abs(ray.dir.z) < 1e-8) { ray.dir.z = 1e-8; }

  let tBox = intersectBoundingBox(ray, boxMin, boxMax);
  let near = tBox.x;
  let far = tBox.y;
  var origin: vec3f;

  if (near <= 0.0 && far > 0.0) {
    // Ray originates from within the bounding box.
    origin = ray.origin;
  } else if (near > 0.0 && far > near) {
    origin = ray.origin + ray.dir * (near - EPSILON);
  } else {
    return MISS;
  }

  // Origin from the perspective of the grid (0, 0, 0) position
  let toOrigin = origin - boxMin;

  let deltaT = 1.0 / ray.dir * sign(ray.dir);
  let side = step(vec3f(0.0), ray.dir);
  var tSet = (floor(toOrigin) + side - toOrigin) / ray.dir;
  var cellIndex = vec3i(floor(toOrigin));
  var normal = vec3f(0.0);

  // A grid walk can cross at most one cell per axis per step.
  let limit = shape.size.x + shape.size.y + shape.size.z + 3;

  for (var it = 0; it < limit; it++) {
    let minT = min(tSet.x, min(tSet.y, tSet.z));

    if (tSet.x == minT) {
      tSet.x += deltaT.x;
      cellIndex.x += i32(sign(ray.dir.x));
      normal = vec3f(-sign(ray.dir.x), 0.0, 0.0);
    } else if (tSet.y == minT) {
      tSet.y += deltaT.y;
      cellIndex.y += i32(sign(ray.dir.y));
      normal = vec3f(0.0, -sign(ray.dir.y), 0.0);
    } else {
      tSet.z += deltaT.z;
      cellIndex.z += i32(sign(ray.dir.z));
      normal = vec3f(0.0, 0.0, -sign(ray.dir.z));
    }

    if (any(cellIndex < vec3i(-1)) || any(cellIndex >= shape.size + vec3i(1))) {
      break;
    } else if (all(cellIndex >= vec3i(0)) && all(cellIndex < shape.size)) {
      let materialIndex = voxelAt(shape, cellIndex);

      // A hit means exiting the current medium (vacuum or glass).
      if (materialIndex != mediumIndex) {
        let voxMin = vec3f(cellIndex + shape.pivot);
        let voxMax = voxMin + 1.0;
        let tVox = intersectBoundingBox(ray, voxMin, voxMax);
        let hitT = tVox.x;
        let hitPos = originalRay.origin + originalRay.dir * hitT;
        let hitNormal = shape.rotation * normal;
        return Hit(true, hitT, hitPos, hitNormal, materialIndex);
      }
    }
  }

  return MISS;
}

fn intersectGround(ray: Ray) -> Hit {
  let groundMin = vec3f(-100000.0);
  let groundMax = vec3f(100000.0, 0.0, 100000.0);
  let tBox = intersectBoundingBox(ray, groundMin, groundMax);
  let tNear = tBox.x;
  let tFar = tBox.y;

  if (tNear > 0.0 && tFar > tNear) {
    let hitPos = ray.origin + ray.dir * tNear;
    return Hit(true, tNear, hitPos, vec3f(0.0, 1.0, 0.0), GROUND_MATERIAL_INDEX);
  }
  return MISS;
}

/**
 * Nearest hit across all shapes via BVH traversal (median-split tree is
 * balanced, so a 32-deep stack covers ~2^31 shapes), then the ground plane.
 * Nodes farther than the current nearest hit are culled.
 */
fn intersectShapes(ray: Ray, mediumIndex: i32) -> Hit {
  var nearestHit = MISS;

  if (u.shapeCount > 0) {
    let invDir = 1.0 / ray.dir;
    var stack: array<i32, 32>;
    var sp = 0;
    stack[sp] = 0;
    sp++;

    while (sp > 0) {
      sp--;
      let nodeIndex = stack[sp];
      let n0 = bvh[nodeIndex * 2];
      let n1 = bvh[nodeIndex * 2 + 1];

      let tA = (n0.xyz - ray.origin) * invDir;
      let tB = (n1.xyz - ray.origin) * invDir;
      let tMin = min(tA, tB);
      let tMax = max(tA, tB);
      let tNear = max(max(tMin.x, tMin.y), tMin.z);
      let tFar = min(min(tMax.x, tMax.y), tMax.z);
      if (tFar < max(tNear, 0.0)) {
        continue;
      }
      if (nearestHit.didHit && tNear > nearestHit.t) {
        continue;
      }

      let a = i32(n0.w);
      if (a < 0) {
        // leaf: shapes [start, start + count)
        let start = -a - 1;
        let count = i32(n1.w);
        for (var i = 0; i < count; i++) {
          let hit = intersectShape(ray, getShape(start + i), mediumIndex);
          if (hit.didHit && (!nearestHit.didHit || hit.t < nearestHit.t)) {
            nearestHit = hit;
          }
        }
      } else if (sp < 30) {
        stack[sp] = a;
        sp++;
        stack[sp] = i32(n1.w);
        sp++;
      }
    }
  }

  let groundHit = intersectGround(ray);
  if (groundHit.didHit && (!nearestHit.didHit || groundHit.t < nearestHit.t)) {
    nearestHit = groundHit;
  }

  return nearestHit;
}

fn castShadow(pos: vec3f, normal: vec3f, toLight: vec3f) -> f32 {
  if (dot(normal, toLight) <= 0.0) {
    return 0.0;
  }
  let ray = Ray(pos - toLight * EPSILON, toLight);
  let hit = intersectShapes(ray, 0);
  return select(1.0, 0.0, hit.didHit);
}

fn getMaterial(index: i32) -> Material {
  let color = palette[index];
  let options = materials[index]; // raw byte values 0..255

  let mtype = i32(options.x);
  var weight = 0.0;
  var roughness = 0.0;
  var specular = 0.0;
  var refraction = 0.0;
  var flux = 0.0;
  var glow = 0.0;

  if (mtype == MATL_METAL) {
    weight = options.y / 255.0;
    roughness = options.z / 255.0;
    specular = options.w / 255.0;
  } else if (mtype == MATL_GLASS) {
    weight = options.y / 255.0;
    roughness = options.z / 255.0;
    refraction = options.w / 255.0;
  } else if (mtype == MATL_EMISSIVE) {
    weight = options.y / 255.0;
    flux = options.z / 255.0;
    glow = options.w / 255.0;
  }

  return Material(mtype, color, weight, roughness, specular, refraction, flux, glow);
}

// Reference: schlick fresnel
fn fresnel(eta: f32, incident: vec3f, normal: vec3f) -> f32 {
  let f0 = ((eta - 1.0) * (eta - 1.0)) / ((eta + 1.0) * (eta + 1.0));
  // clamp: float error can push the dot past 1, and pow(negative) is NaN
  return f0 + (1.0 - f0) * pow(max(1.0 - dot(normal, -incident), 0.0), 5.0);
}

fn jitterLightDir(dir: vec3f) -> vec3f {
  return normalize(dir + uniformlyRandomVector() * 0.05);
}

fn jitterUV(baseUV: vec2f) -> vec2f {
  let subPixelSideCount = 7;
  let subPixelCount = subPixelSideCount * subPixelSideCount;
  let subPixelIndex = u.tick % subPixelCount;
  let subPixelIJ = vec2i(subPixelIndex % subPixelSideCount, subPixelIndex / subPixelSideCount);
  let subPixelLocalUV = (vec2f(subPixelIJ) + 0.5) / f32(subPixelSideCount);
  let pixelPortion = 1.0 / vec2f(f32(u.resolutionX), f32(u.resolutionY));
  return baseUV + pixelPortion * (subPixelLocalUV - 0.5);
}

/**
 * Returns the bounced/refracted ray and records its kind via gBounceSpecular
 * and gBouncePdf for MIS.
 */
fn bounceRay(rayIn: Ray, hit: Hit, material: Material) -> Ray {
  let r = rand();
  let weight = material.weight;
  gBounceSpecular = false;
  var ray = rayIn;

  if (material.mtype == MATL_METAL && r < weight) {
    gBounceSpecular = true;
    ray.dir = normalize(reflect(ray.dir, hit.normal)) + uniformlyRandomVector() * material.roughness;
    ray.origin = hit.pos + ray.dir * EPSILON;
  } else if (material.mtype == MATL_GLASS && r < weight) {
    gBounceSpecular = true;
    let ior = 1.0 + material.refraction;
    let fresnelReflectance = fresnel(1.0 / ior, ray.dir, hit.normal);

    let refracted = refract(ray.dir, hit.normal, 1.0 / ior);
    // refract() returns the zero vector on total internal reflection —
    // following it yields a near-zero direction and NaN downstream.
    if (rand() > fresnelReflectance && dot(refracted, refracted) > 1e-8) {
      // Refraction
      ray.dir = refracted + uniformlyRandomVector() * material.roughness * 0.08;
      ray.origin = hit.pos + ray.dir * EPSILON;
      let exitHit = intersectShapes(ray, hit.materialIndex);
      if (exitHit.didHit) {
        let exitDir = refract(ray.dir, exitHit.normal, ior);
        if (dot(exitDir, exitDir) > 1e-8) {
          ray.dir = exitDir;
          ray.origin = exitHit.pos - ray.dir * EPSILON;
        }
      }
    } else {
      // Fresnel reflection
      ray.dir = normalize(reflect(ray.dir, hit.normal)) + uniformlyRandomVector() * material.roughness;
      ray.origin = hit.pos + ray.dir * EPSILON;
    }
  } else {
    // Default diffuse bounce
    ray.dir = cosineWeightedDirection(hit.normal);
    ray.origin = hit.pos + ray.dir * EPSILON;
    gBouncePdf = max(dot(ray.dir, hit.normal), 0.0) / PI;
  }

  return ray;
}

/**
 * Next-event estimation toward emissive voxels, MIS-balanced against the
 * cosine-bounce strategy (pNee = d^2/N vs pBrdf = cos/pi) so big emitters
 * stay with the bounce estimator and small lamps converge via NEE.
 */
fn sampleEmissive(hit: Hit, diffuseFactor: f32) -> vec3f {
  if (u.lightCount == 0 || diffuseFactor <= 0.0) {
    return vec3f(0.0);
  }
  // Per-pixel decorrelated, tick-stratified light pick. The main RNG is
  // seeded per frame (uniform across pixels, for the light-swing look);
  // reusing it here would converge to iso-distance banding.
  let h = pcg((gPixel.x * 1973u) ^ (gPixel.y * 9277u));
  let li = i32((h + u32(u.tick) * 2654435761u) % u32(u.lightCount));
  let light = lights[li];
  let toLight = light.xyz - hit.pos;
  let dist = length(toLight);
  if (dist < 0.87) {
    // inside the emitter voxel's half-diagonal; contact light is handled by
    // the classic emission term
    return vec3f(0.0);
  }
  let dir = toLight / dist;
  let cosSurf = dot(hit.normal, dir);
  if (cosSurf <= 0.0) {
    return vec3f(0.0);
  }

  let shadowRay = Ray(hit.pos + dir * EPSILON, dir);
  let blocker = intersectShapes(shadowRay, 0);
  // The emitter voxel itself is geometry: a hit near the light distance
  // (within the voxel's ~0.87 half-diagonal) is the emitter, not a blocker.
  if (blocker.didHit && blocker.t < dist - 0.9) {
    return vec3f(0.0);
  }

  let lm = getMaterial(i32(light.w));
  let emitStrength = lm.weight * 30.0 * lm.flux;
  let pNee = (dist * dist) / f32(u.lightCount);
  let pBrdf = cosSurf / PI;
  let misWeight = pNee / (pNee + pBrdf);
  let geom = cosSurf / (PI * dist * dist);
  return lm.color.rgb * emitStrength * geom * diffuseFactor * f32(u.lightCount) * misWeight;
}

// ------------------------------------------------------------------- main

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let res = vec2i(u.resolutionX, u.resolutionY);
  if (i32(gid.x) >= res.x || i32(gid.y) >= res.y) {
    return;
  }
  let pixel = vec2i(gid.xy);
  gPixel = gid.xy;

  // Seed per-frame only (no pixel coords): every pixel shares the same
  // random sequence within a tick, like the original renderer. Convergence
  // reads as the light direction swinging frame-to-frame instead of
  // per-pixel grain.
  rngState = pcg(u32(u.tick) * 26699u + 1u);

  let groundMaterial = Material(
    MATL_DIFFUSE,
    vec4f(u.groundColor.rgb, 1.0),
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0
  );

  let normalizedLightDir = normalize(u.lightDir.xyz);
  let jitteredLightDir = jitterLightDir(normalizedLightDir);

  // pixel row 0 = top of the canvas; flip v so NDC y=+1 is the top,
  // matching the WebGL backend's image orientation.
  let uv = vec2f(
    (f32(pixel.x) + 0.5) / f32(res.x),
    1.0 - (f32(pixel.y) + 0.5) / f32(res.y)
  );

  // Anti-aliasing
  var jitteredUV = uv;
  if (u.tick != 0) {
    jitteredUV = jitterUV(uv);
  }

  var ray = castRay(jitteredUV);
  var accumulatedColor = vec3f(0.0);
  var colorMask = vec3f(1.0);

  let calibratedLightColor = u.lightColor.rgb * 2.0;

  for (var i = 0; i < BOUNCE_LIMIT + 1; i++) {
    let hit = intersectShapes(ray, 0);

    if (!hit.didHit) {
      accumulatedColor += colorMask * u.skyColor.rgb;
      break;
    }

    // Tick 0 is the interactive preview (every drag frame restarts at
    // tick 0): skip the sun shadow ray so it costs a single traversal
    // per pixel. Shading fidelity returns from tick 1 onward.
    var shadowMultiplier = 1.0;
    if (u.tick != 0) {
      shadowMultiplier = castShadow(hit.pos, hit.normal, jitteredLightDir);
    }

    var material: Material;
    if (hit.materialIndex == GROUND_MATERIAL_INDEX) {
      material = groundMaterial;
    } else {
      material = getMaterial(hit.materialIndex);
    }

    let materialWeight = material.weight;
    let surfaceColor = material.color.rgb;
    var diffuseAmount = 0.0;
    var specularHighlight = 0.0;
    var emission = 0.0;

    if (material.mtype == MATL_METAL) {
      colorMask *= surfaceColor;
      diffuseAmount = max(0.0, dot(jitteredLightDir, hit.normal));
      let reflectedLight = normalize(reflect(jitteredLightDir - hit.pos, hit.normal));
      specularHighlight = max(0.0, dot(reflectedLight, normalize(hit.pos - ray.origin)));
      specularHighlight = materialWeight * material.specular * pow(specularHighlight, 3.0);
    }
    // Note: metal intentionally falls through to the final else as well —
    // this matches the original shader's behavior (and its known
    // "overdosing diffuse on metal" quirk) to keep golden parity.
    if (material.mtype == MATL_GLASS) {
      colorMask *= vec3f(1.0) * materialWeight + (1.0 - materialWeight) * surfaceColor;
      diffuseAmount = (1.0 - materialWeight) * max(0.0, dot(jitteredLightDir, hit.normal));
    } else if (material.mtype == MATL_EMISSIVE) {
      colorMask *= surfaceColor;
      diffuseAmount = (1.0 - materialWeight) * max(0.0, dot(jitteredLightDir, hit.normal));
      emission = materialWeight * 30.0 * material.flux;
    } else {
      colorMask *= surfaceColor;
      diffuseAmount = max(0.0, dot(jitteredLightDir, hit.normal));
    }

    // With NEE on, indirect diffuse-path emitter hits are MIS-weighted
    // against the light-sampling strategy (primary hits and specular paths
    // keep full emission — NEE never covers those).
    if (u.neeEnabled == 1 && i > 0 && !gBounceSpecular && u.lightCount > 0 && emission > 0.0) {
      let pNee = (hit.t * hit.t) / f32(u.lightCount);
      emission *= gBouncePdf / (gBouncePdf + pNee);
    }

    accumulatedColor += colorMask * diffuseAmount * shadowMultiplier;
    accumulatedColor += colorMask * specularHighlight * calibratedLightColor * shadowMultiplier;
    accumulatedColor += colorMask * emission;

    // Next-event estimation toward emissive voxels
    if (u.neeEnabled == 1 && u.tick != 0 && material.mtype != MATL_EMISSIVE) {
      var neeFactor = 1.0;
      if (material.mtype == MATL_GLASS || material.mtype == MATL_METAL) {
        // diffuse transport probability of these materials' bounce
        neeFactor = 1.0 - materialWeight;
      }
      accumulatedColor += colorMask * sampleEmissive(hit, neeFactor);
    }

    // The first frame is rendered without indirect lighting so something
    // shows up immediately.
    if (u.tick == 0) {
      break;
    }

    ray = bounceRay(ray, hit, material);
  }

  // Ignore the first render since it is an interstitial render without
  // indirect lighting.
  let effectiveTick = select(u.tick, u.tick - 1, u.tick > 1);
  let weight = 1.0 / f32(effectiveTick + 1);
  var previousColor = vec4f(0.0);
  if (effectiveTick > 0) {
    previousColor = textureLoad(prevFrame, pixel, 0);
  }
  textureStore(outFrame, pixel, mix(previousColor, vec4f(accumulatedColor, 1.0), weight));
}
`,n=`// Presents the latest accumulation texture to the canvas: a fullscreen
// triangle and a direct texel fetch (nearest, 1:1).

@group(0) @binding(0) var src: texture_2d<f32>;

@vertex
fn vs(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4f {
  var pos = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  return vec4f(pos[vi], 0.0, 1.0);
}

@fragment
fn fs(@builtin(position) p: vec4f) -> @location(0) vec4f {
  let size = textureDimensions(src);
  let q = clamp(vec2i(p.xy), vec2i(0), vec2i(size) - 1);
  return vec4f(textureLoad(src, q, 0).rgb, 1.0);
}
`,r=240,i=class{constructor(e){this.kind=`webgpu`,this.uniformF32=new Float32Array(r/4),this.uniformI32=new Int32Array(this.uniformF32.buffer),this.atlasTexture=null,this.shapeBuffer=null,this.bvhBuffer=null,this.lightBuffer=null,this.paletteBuffer=null,this.materialBuffer=null,this.accumTextures=null,this.traceBindGroups=null,this.presentBindGroups=null,this.readIndex=0,this.width=1,this.height=1,this.canvas=e}async init(){let e=navigator.gpu;if(!e)throw Error(`navigator.gpu is not available`);let i=await e.requestAdapter();if(!i)throw Error(`no WebGPU adapter`);this.device=await i.requestDevice(),this.format=e.getPreferredCanvasFormat();let a=this.device.createShaderModule({code:t}),o=this.device.createShaderModule({code:n});for(let[e,t]of[[`pathTracer.wgsl`,a],[`present.wgsl`,o]]){let n=(await t.getCompilationInfo()).messages.filter(e=>e.type===`error`);if(n.length>0){let t=n.map(t=>`${e}:${t.lineNum}:${t.linePos} ${t.message}`).join(`
`);throw Error(`WGSL compile failed:\n${t}`)}}this.tracePipeline=this.device.createComputePipeline({layout:`auto`,compute:{module:a,entryPoint:`main`}}),this.presentPipeline=this.device.createRenderPipeline({layout:`auto`,vertex:{module:o,entryPoint:`vs`},fragment:{module:o,entryPoint:`fs`,targets:[{format:this.format}]},primitive:{topology:`triangle-list`}}),this.uniformBuffer=this.device.createBuffer({size:r,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});let s=this.canvas.getContext(`webgpu`);if(!s)throw Error(`webgpu canvas context unavailable`);this.context=s,this.context.configure({device:this.device,format:this.format,alphaMode:`opaque`}),this.setVec4(36,[-1.1,1.9,1.7],0,!0),this.uniformI32[58]=1}get maxAtlasSize(){return this.device.limits.maxTextureDimension3D}storageBuffer(e){let t=Math.max(16,e.byteLength),n=this.device.createBuffer({size:t,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});return e.byteLength>0&&this.device.queue.writeBuffer(n,0,e.buffer,e.byteOffset,e.byteLength),n}setVec4(e,t,n=0,r=!1){let[i,a,o]=t;if(r){let e=Math.hypot(i,a,o)||1;i/=e,a/=e,o/=e}this.uniformF32[e]=i,this.uniformF32[e+1]=a,this.uniformF32[e+2]=o,this.uniformF32[e+3]=n}setScene(t){let n=e(t,this.maxAtlasSize);this.disposeSceneResources();let[r,i,a]=n.atlasSize;this.atlasTexture=this.device.createTexture({size:{width:r,height:i,depthOrArrayLayers:a},dimension:`3d`,format:`r8uint`,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST}),this.device.queue.writeTexture({texture:this.atlasTexture},n.atlas,{bytesPerRow:r,rowsPerImage:i},{width:r,height:i,depthOrArrayLayers:a}),this.shapeBuffer=this.storageBuffer(n.shapes),this.bvhBuffer=this.storageBuffer(n.bvh),this.lightBuffer=this.storageBuffer(n.lights);let o=new Float32Array(1024),s=new Float32Array(1024);for(let e=0;e<1024;e++)o[e]=n.palette[e]/255,s[e]=n.materials[e];this.paletteBuffer=this.storageBuffer(o),this.materialBuffer=this.storageBuffer(s),this.setVec4(40,[t.lightColor.r,t.lightColor.g,t.lightColor.b],1),this.setVec4(44,[t.skyColor.r,t.skyColor.g,t.skyColor.b],1),this.setVec4(48,[t.groundColor.r,t.groundColor.g,t.groundColor.b],1),this.uniformI32[56]=n.shapeCount,this.uniformI32[57]=n.lightCount,this.traceBindGroups=null}setCamera(e){e.updateMatrixWorld(),this.uniformF32.set(e.matrixWorld.elements,0),this.uniformF32.set(e.projectionMatrixInverse.elements,16),this.setVec4(32,[e.position.x,e.position.y,e.position.z],1)}setSize(e,t,n){this.width=Math.max(1,Math.floor(e*n)),this.height=Math.max(1,Math.floor(t*n)),this.canvas.width=this.width,this.canvas.height=this.height,this.accumTextures?.forEach(e=>e.destroy());let r=()=>this.device.createTexture({size:{width:this.width,height:this.height},format:`rgba16float`,usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING});this.accumTextures=[r(),r()],this.traceBindGroups=null}setEmissiveSampling(e){this.uniformI32[58]=+!!e}setMaxTick(e){this.uniformI32[55]=e}ensureBindGroups(){if(this.traceBindGroups&&this.presentBindGroups)return!0;if(!this.accumTextures||!this.atlasTexture)return!1;let e=[this.accumTextures[0].createView(),this.accumTextures[1].createView()],t=this.tracePipeline.getBindGroupLayout(0),n=n=>this.device.createBindGroup({layout:t,entries:[{binding:0,resource:{buffer:this.uniformBuffer}},{binding:1,resource:this.atlasTexture.createView()},{binding:2,resource:{buffer:this.shapeBuffer}},{binding:3,resource:{buffer:this.bvhBuffer}},{binding:4,resource:{buffer:this.lightBuffer}},{binding:5,resource:{buffer:this.paletteBuffer}},{binding:6,resource:{buffer:this.materialBuffer}},{binding:7,resource:e[n]},{binding:8,resource:e[1-n]}]});this.traceBindGroups=[n(0),n(1)];let r=this.presentPipeline.getBindGroupLayout(0),i=t=>this.device.createBindGroup({layout:r,entries:[{binding:0,resource:e[t]}]});return this.presentBindGroups=[i(0),i(1)],!0}renderTicks(e,t){if(!this.ensureBindGroups())return;this.uniformI32[52]=this.width,this.uniformI32[53]=this.height;let n=Math.ceil(this.width/8),i=Math.ceil(this.height/8);for(let a=0;a<t;a++){this.uniformI32[54]=e+a,this.device.queue.writeBuffer(this.uniformBuffer,0,this.uniformF32.buffer,0,r);let t=this.device.createCommandEncoder(),o=t.beginComputePass();o.setPipeline(this.tracePipeline),o.setBindGroup(0,this.traceBindGroups[this.readIndex]),o.dispatchWorkgroups(n,i),o.end(),this.device.queue.submit([t.finish()]),this.readIndex=1-this.readIndex}let a=this.device.createCommandEncoder(),o=a.beginRenderPass({colorAttachments:[{view:this.context.getCurrentTexture().createView(),clearValue:{r:0,g:0,b:0,a:1},loadOp:`clear`,storeOp:`store`}]});o.setPipeline(this.presentPipeline),o.setBindGroup(0,this.presentBindGroups[this.readIndex]),o.draw(3),o.end(),this.device.queue.submit([a.finish()])}async captureBlob(e=`image/jpeg`,t=.95){return new Promise(n=>{this.canvas.toBlob(e=>n(e),e,t)})}disposeSceneResources(){this.atlasTexture?.destroy(),this.shapeBuffer?.destroy(),this.bvhBuffer?.destroy(),this.lightBuffer?.destroy(),this.paletteBuffer?.destroy(),this.materialBuffer?.destroy(),this.atlasTexture=null,this.traceBindGroups=null}dispose(){this.disposeSceneResources(),this.accumTextures?.forEach(e=>e.destroy()),this.uniformBuffer?.destroy(),this.device?.destroy()}};export{i as WebGPUBackend};