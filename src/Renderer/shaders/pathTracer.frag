// GLSL ES 3.00 voxel path tracer.
// Port of the original glslify-modular GLSL ES 1.00 shader set
// (src/Shaders at the time of the WebGL2 migration), consolidated into a
// single program. Voxels live in an R8UI 3D atlas; shape metadata in an
// RGBA32F texture so the shape count is dynamic.

precision highp float;
precision highp int;
precision highp usampler3D;

// ---------------------------------------------------------------- structs

struct Ray {
  vec3 origin;
  vec3 dir;
};

struct Hit {
  bool didHit;
  float t;
  vec3 pos;
  vec3 normal;
  int materialIndex;
};

struct Material {
  int type;
  vec4 color;
  float weight;
  float roughness;
  float specular;
  float refraction;
  float flux;
  float glow;
};

struct Shape {
  mat3 rotation;
  vec3 translation;
  ivec3 size;
  ivec3 pos;
  ivec3 atlasOffset;
};

// -------------------------------------------------------------- constants

const int MATL_DIFFUSE = 0;
const int MATL_METAL = 1;
const int MATL_GLASS = 2;
const int MATL_EMISSIVE = 3;
const int GROUND_MATERIAL_INDEX = 0;
const int BOUNCE_LIMIT = 2;
const float EPSILON = 0.0001;
const Hit MISS = Hit(false, 0.0, vec3(0.0), vec3(0.0), 0);

// --------------------------------------------------------------- uniforms

in vec2 uv;
out vec4 fragColor;

uniform vec3 eye;
uniform vec3 lightDir;
uniform vec3 lightColor;
uniform vec3 skyColor;
uniform vec3 groundColor;
uniform mat4 viewMatrixInverse;
uniform mat4 projectionMatrixInverse;
uniform int tick;
uniform int maxTick;
uniform ivec2 resolution;

uniform usampler3D voxelAtlas;
uniform sampler2D shapeTex; // SHAPE_TEX_WIDTH x shapeCount RGBA32F
uniform sampler2D bvhTex; // 2 x nodeCount RGBA32F (see ShapeBvh.ts layout)
uniform sampler2D lightTex; // 1 x lightCount RGBA32F: emissive voxel centers + material index
uniform int shapeCount;
uniform int lightCount;
uniform int neeEnabled; // 1 = sample emissive voxels directly (next-event estimation)
uniform sampler2D colorTexture;
uniform sampler2D materialTexture;
uniform sampler2D previousFrame;

// -------------------------------------------------------------------- rng

uint rngState;

uint pcg(uint v) {
  v = v * 747796405u + 2891336453u;
  uint w = ((v >> ((v >> 28u) + 4u)) ^ v) * 277803737u;
  return (w >> 22u) ^ w;
}

float rand() {
  rngState = pcg(rngState);
  return float(rngState) / 4294967296.0;
}

vec3 uniformlyRandomDirection() {
  float u = rand();
  float v = rand();
  float z = 1.0 - 2.0 * u;
  float r = sqrt(1.0 - z * z);
  float angle = 6.283185307179586 * v;
  return vec3(r * cos(angle), r * sin(angle), z);
}

vec3 uniformlyRandomVector() {
  return uniformlyRandomDirection() * sqrt(rand());
}

/**
 * Cosine weighted direction from
 * http://www.rorydriscoll.com/2009/01/07/better-sampling/
 */
vec3 cosineWeightedDirection(vec3 normal) {
  float u = rand();
  float v = rand();
  float r = sqrt(u);
  float angle = 6.283185307179586 * v;
  vec3 sdir, tdir;
  if (abs(normal.x) < 0.5) {
    sdir = cross(normal, vec3(1, 0, 0));
  } else {
    sdir = cross(normal, vec3(0, 1, 0));
  }
  tdir = cross(normal, sdir);
  return r * cos(angle) * sdir + r * sin(angle) * tdir + sqrt(1.0 - u) * normal;
}

// -------------------------------------------------------------- functions

Ray castRay(vec2 rayUV) {
  vec4 q = viewMatrixInverse * projectionMatrixInverse * vec4((rayUV - 0.5) * 2.0, 1.0, 1.0);
  vec3 rayDirection = normalize(q.xyz / q.w - eye);
  return Ray(eye, rayDirection);
}

vec2 intersectBoundingBox(Ray ray, vec3 boxMin, vec3 boxMax) {
  vec3 tMin = (boxMin - ray.origin) / ray.dir;
  vec3 tMax = (boxMax - ray.origin) / ray.dir;
  vec3 t1 = min(tMin, tMax);
  vec3 t2 = max(tMin, tMax);
  float tNear = max(max(t1.x, t1.y), t1.z);
  float tFar = min(min(t2.x, t2.y), t2.z);
  return vec2(tNear, tFar);
}

Shape getShape(int i) {
  vec4 r0 = texelFetch(shapeTex, ivec2(0, i), 0);
  vec4 r1 = texelFetch(shapeTex, ivec2(1, i), 0);
  vec4 r2 = texelFetch(shapeTex, ivec2(2, i), 0);
  vec4 sz = texelFetch(shapeTex, ivec2(3, i), 0);
  vec4 ps = texelFetch(shapeTex, ivec2(4, i), 0);
  vec4 ao = texelFetch(shapeTex, ivec2(5, i), 0);
  // texels hold matrix rows; mat3(col, col, col) + transpose restores M
  mat3 rot = transpose(mat3(r0.xyz, r1.xyz, r2.xyz));
  return Shape(rot, vec3(r0.w, r1.w, r2.w), ivec3(sz.xyz), ivec3(ps.xyz), ivec3(ao.xyz));
}

int voxelAt(Shape shape, ivec3 cellIndex) {
  return int(texelFetch(voxelAtlas, shape.atlasOffset + cellIndex, 0).r);
}

Hit intersectShape(Ray ray, Shape shape, int mediumIndex) {
  vec3 boxMin = vec3(shape.pos);
  vec3 boxMax = vec3(shape.pos + shape.size);

  Ray originalRay = ray;

  // Transform ray using inverse model transformation.
  // Model = Translation * Rotation; inverse(Rotation) = transpose(Rotation).
  mat3 inverseRotation = transpose(shape.rotation);
  ray.dir = inverseRotation * ray.dir;
  ray.origin = inverseRotation * (ray.origin - shape.translation);

  // Exactly-zero direction components make the DDA math produce NaN
  // (1/0 * sign(0) = inf * 0), which poisons the accumulation buffer
  // forever — seen as permanent black speckles. Nudge them off zero.
  if (abs(ray.dir.x) < 1e-8) ray.dir.x = 1e-8;
  if (abs(ray.dir.y) < 1e-8) ray.dir.y = 1e-8;
  if (abs(ray.dir.z) < 1e-8) ray.dir.z = 1e-8;

  vec2 tBox = intersectBoundingBox(ray, boxMin, boxMax);
  float near = tBox.x;
  float far = tBox.y;
  vec3 origin;

  if (near <= 0.0 && far > 0.0) {
    // Ray originates from within the bounding box.
    origin = ray.origin;
  } else if (near > 0.0 && far > near) {
    origin = ray.origin + ray.dir * (near - EPSILON);
  } else {
    return MISS;
  }

  // Origin from the perspective of the grid (0, 0, 0) position
  vec3 toOrigin = origin - boxMin;

  vec3 deltaT = 1.0 / ray.dir * sign(ray.dir);
  vec3 side = step(0.0, ray.dir);
  vec3 tSet = (floor(toOrigin) + side - toOrigin) / ray.dir;
  ivec3 cellIndex = ivec3(floor(toOrigin));
  vec3 normal;

  // A grid walk can cross at most one cell per axis per step.
  int limit = shape.size.x + shape.size.y + shape.size.z + 3;

  for (int it = 0; it < limit; ++it) {
    float minT = min(tSet.x, min(tSet.y, tSet.z));

    if (tSet.x == minT) {
      tSet.x += deltaT.x;
      cellIndex.x += int(sign(ray.dir.x));
      normal = vec3(-sign(ray.dir.x), 0.0, 0.0);
    } else if (tSet.y == minT) {
      tSet.y += deltaT.y;
      cellIndex.y += int(sign(ray.dir.y));
      normal = vec3(0.0, -sign(ray.dir.y), 0.0);
    } else {
      tSet.z += deltaT.z;
      cellIndex.z += int(sign(ray.dir.z));
      normal = vec3(0.0, 0.0, -sign(ray.dir.z));
    }

    if (any(lessThan(cellIndex, ivec3(-1))) ||
        any(greaterThanEqual(cellIndex, shape.size + 1))) {
      break;
    } else if (all(greaterThanEqual(cellIndex, ivec3(0))) &&
               all(lessThan(cellIndex, shape.size))) {
      int materialIndex = voxelAt(shape, cellIndex);

      // A hit means exiting the current medium (vacuum or glass).
      if (materialIndex != mediumIndex) {
        vec3 voxMin = vec3(cellIndex + shape.pos);
        vec3 voxMax = voxMin + 1.0;
        vec2 tVox = intersectBoundingBox(ray, voxMin, voxMax);
        float hitT = tVox.x;
        vec3 hitPos = originalRay.origin + originalRay.dir * hitT;
        vec3 hitNormal = shape.rotation * normal;
        return Hit(true, hitT, hitPos, hitNormal, materialIndex);
      }
    }
  }

  return MISS;
}

Hit intersectGround(Ray ray) {
  vec3 groundMin = vec3(-100000.0);
  vec3 groundMax = vec3(100000.0, 0.0, 100000.0);
  vec2 tBox = intersectBoundingBox(ray, groundMin, groundMax);
  float tNear = tBox.x;
  float tFar = tBox.y;

  if (tNear > 0.0 && tFar > tNear) {
    vec3 hitPos = ray.origin + ray.dir * tNear;
    return Hit(true, tNear, hitPos, vec3(0.0, 1.0, 0.0), GROUND_MATERIAL_INDEX);
  }
  return MISS;
}

/**
 * Nearest hit across all shapes via BVH traversal (median-split tree is
 * balanced, so a 32-deep stack covers ~2^31 shapes), then the ground plane.
 * Nodes farther than the current nearest hit are culled.
 */
Hit intersectShapes(Ray ray, int mediumIndex) {
  Hit nearestHit = MISS;

  if (shapeCount > 0) {
    vec3 invDir = 1.0 / ray.dir;
    int stack[32];
    int sp = 0;
    stack[sp++] = 0;

    while (sp > 0) {
      int nodeIndex = stack[--sp];
      vec4 n0 = texelFetch(bvhTex, ivec2(0, nodeIndex), 0);
      vec4 n1 = texelFetch(bvhTex, ivec2(1, nodeIndex), 0);

      vec3 tA = (n0.xyz - ray.origin) * invDir;
      vec3 tB = (n1.xyz - ray.origin) * invDir;
      vec3 tMin = min(tA, tB);
      vec3 tMax = max(tA, tB);
      float tNear = max(max(tMin.x, tMin.y), tMin.z);
      float tFar = min(min(tMax.x, tMax.y), tMax.z);
      if (tFar < max(tNear, 0.0)) continue;
      if (nearestHit.didHit && tNear > nearestHit.t) continue;

      int a = int(n0.w);
      if (a < 0) {
        // leaf: shapes [start, start + count)
        int start = -a - 1;
        int count = int(n1.w);
        for (int i = 0; i < count; ++i) {
          Hit hit = intersectShape(ray, getShape(start + i), mediumIndex);
          if (hit.didHit && (!nearestHit.didHit || hit.t < nearestHit.t)) {
            nearestHit = hit;
          }
        }
      } else if (sp < 30) {
        stack[sp++] = a;
        stack[sp++] = int(n1.w);
      }
    }
  }

  Hit groundHit = intersectGround(ray);
  if (groundHit.didHit && (!nearestHit.didHit || groundHit.t < nearestHit.t)) {
    nearestHit = groundHit;
  }

  return nearestHit;
}

float castShadow(vec3 pos, vec3 normal, vec3 toLight) {
  if (dot(normal, toLight) <= 0.0) {
    return 0.0;
  }
  Ray ray = Ray(pos - toLight * EPSILON, toLight);
  Hit hit = intersectShapes(ray, 0);
  return hit.didHit ? 0.0 : 1.0;
}

Material getMaterial(int index) {
  ivec2 pos = ivec2(index % 16, index / 16);
  vec4 color = texelFetch(colorTexture, pos, 0);
  vec4 options = texelFetch(materialTexture, pos, 0);

  int type = int(options.r * 255.0);
  float weight = 0.0;
  float roughness = 0.0;
  float specular = 0.0;
  float refraction = 0.0;
  float flux = 0.0;
  float glow = 0.0;

  if (type == MATL_METAL) {
    weight = options.g;
    roughness = options.b;
    specular = options.a;
  } else if (type == MATL_GLASS) {
    weight = options.g;
    roughness = options.b;
    refraction = options.a;
  } else if (type == MATL_EMISSIVE) {
    weight = options.g;
    flux = options.b;
    glow = options.a;
  }

  return Material(type, color, weight, roughness, specular, refraction, flux, glow);
}

// Reference: https://drive.google.com/file/d/0B8g97JkuSSBwUENiWTJXeGtTOHFmSm51UC01YWtCZw/view
float fresnel(float eta, vec3 incident, vec3 normal) {
  float f0 = ((eta - 1.0) * (eta - 1.0)) / ((eta + 1.0) * (eta + 1.0));
  // clamp: float error can push the dot past 1, and pow(negative) is NaN
  float fr = f0 + (1.0 - f0) * pow(max(1.0 - dot(normal, -incident), 0.0), 5.0);
  return fr;
}

vec3 jitterLightDir(vec3 dir) {
  return normalize(dir + uniformlyRandomVector() * 0.05);
}

vec2 jitterUV(vec2 baseUV) {
  const int subPixelSideCount = 7;
  int subPixelCount = subPixelSideCount * subPixelSideCount;
  int subPixelIndex = tick % subPixelCount;
  ivec2 subPixelIJ = ivec2(subPixelIndex % subPixelSideCount, subPixelIndex / subPixelSideCount);
  vec2 subPixelLocalUV = (vec2(subPixelIJ) + 0.5) / float(subPixelSideCount);
  vec2 pixelPortion = 1.0 / vec2(resolution);
  return baseUV + pixelPortion * (subPixelLocalUV - 0.5);
}

// Whether the most recent bounce was specular (mirror/refraction). NEE only
// covers diffuse transport, so emitter hits after a specular bounce must
// still add their emission term.
bool gBounceSpecular = false;
// Solid-angle pdf of the most recent diffuse bounce direction (cos/pi),
// used for MIS weighting against the light-sample pdf.
float gBouncePdf = 0.0;

/**
 * Returns a new ray if we were able to bounce or refract.
 * Otherwise the exact same ray is returned.
 */
Ray bounceRay(Ray ray, Hit hit, Material material) {
  float r = rand();
  float weight = material.weight;
  gBounceSpecular = false;

  if (material.type == MATL_METAL && r < weight) {
    gBounceSpecular = true;
    ray.dir = normalize(reflect(ray.dir, hit.normal)) + uniformlyRandomVector() * material.roughness;
    ray.origin = hit.pos + ray.dir * EPSILON;
  } else if (material.type == MATL_GLASS && r < weight) {
    gBounceSpecular = true;
    float ior = 1.0 + material.refraction;
    float fresnelReflectance = fresnel(1.0 / ior, ray.dir, hit.normal);

    vec3 refracted = refract(ray.dir, hit.normal, 1.0 / ior);
    // refract() returns the zero vector on total internal reflection —
    // following it yields a near-zero direction and NaN downstream.
    if (rand() > fresnelReflectance && dot(refracted, refracted) > 1e-8) {
      // Refraction
      ray.dir = refracted + uniformlyRandomVector() * material.roughness * 0.08;
      ray.origin = hit.pos + ray.dir * EPSILON;
      Hit exitHit = intersectShapes(ray, hit.materialIndex);
      if (exitHit.didHit) {
        vec3 exitDir = refract(ray.dir, exitHit.normal, ior);
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
    gBouncePdf = max(dot(ray.dir, hit.normal), 0.0) / 3.141592653589793;
  }

  return ray;
}

/**
 * Next-event estimation toward emissive voxels: sample one light from the
 * list, cast a shadow ray, and return its direct contribution. Matches the
 * brightness of the classic "bounce happens to hit the emitter" estimator
 * (cosine-weighted bounce pdf = cos/pi over a ~unit-area voxel) so toggling
 * NEE changes noise, not look.
 */
vec3 sampleEmissive(Hit hit, float diffuseFactor) {
  if (lightCount == 0 || diffuseFactor <= 0.0) {
    return vec3(0.0);
  }
  // Per-pixel decorrelated, tick-stratified light pick. The main RNG is
  // seeded per frame (uniform across pixels, for the light-swing look);
  // reusing it here would make every pixel sample the same light and
  // converge to iso-distance banding.
  uint h = pcg(uint(gl_FragCoord.x) * 1973u ^ uint(gl_FragCoord.y) * 9277u);
  int li = int((h + uint(tick) * 2654435761u) % uint(lightCount));
  vec4 light = texelFetch(lightTex, ivec2(0, li), 0);
  vec3 toLight = light.xyz - hit.pos;
  float dist = length(toLight);
  if (dist < 0.87) {
    // inside the emitter voxel's half-diagonal; contact light is handled by
    // the classic emission term
    return vec3(0.0);
  }
  vec3 dir = toLight / dist;
  float cosSurf = dot(hit.normal, dir);
  if (cosSurf <= 0.0) {
    return vec3(0.0);
  }

  Ray shadowRay = Ray(hit.pos + dir * EPSILON, dir);
  Hit blocker = intersectShapes(shadowRay, 0);
  // The emitter voxel itself is geometry: a hit near the light distance
  // (within the voxel's ~0.87 half-diagonal) is the emitter, not a blocker.
  if (blocker.didHit && blocker.t < dist - 0.9) {
    return vec3(0.0);
  }

  Material lm = getMaterial(int(light.w));
  float emitStrength = lm.weight * 30.0 * lm.flux;
  // unit-area voxel emitter: estimator cos/(pi d^2) * lightCount, balanced
  // against the cosine-bounce strategy via MIS so big emitters stay with
  // the bounce estimator and small ones with NEE.
  float pNee = (dist * dist) / float(lightCount);
  float pBrdf = cosSurf / 3.141592653589793;
  float misWeight = pNee / (pNee + pBrdf);
  float geom = cosSurf / (3.141592653589793 * dist * dist);
  return lm.color.rgb * emitStrength * geom * diffuseFactor * float(lightCount) * misWeight;
}

// ------------------------------------------------------------------- main

void main() {
  // Seed per-frame only (no gl_FragCoord): every pixel shares the same
  // random sequence within a tick, like the original renderer. Convergence
  // reads as the light direction swinging frame-to-frame instead of
  // per-pixel grain.
  rngState = pcg(uint(tick) * 26699u + 1u);

  Material groundMaterial = Material(
    MATL_DIFFUSE,
    vec4(groundColor, 1.0),
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0
  );

  vec3 normalizedLightDir = normalize(lightDir);
  vec3 jitteredLightDir = jitterLightDir(normalizedLightDir);

  // Anti-aliasing
  vec2 jitteredUV = tick == 0 ? uv : jitterUV(uv);

  Ray ray = castRay(jitteredUV);
  vec3 accumulatedColor = vec3(0.0);
  vec3 colorMask = vec3(1.0);

  vec3 calibratedLightColor = lightColor * 2.0;

  for (int i = 0; i < BOUNCE_LIMIT + 1; ++i) {
    Hit hit = intersectShapes(ray, 0);

    if (!hit.didHit) {
      accumulatedColor += colorMask * skyColor;
      break;
    }

    // Tick 0 is the interactive preview (every drag frame restarts at
    // tick 0): skip the sun shadow ray so it costs a single traversal
    // per pixel. Shading fidelity returns from tick 1 onward.
    float shadowMultiplier = tick == 0 ? 1.0 : castShadow(hit.pos, hit.normal, jitteredLightDir);

    Material material;
    if (hit.materialIndex == GROUND_MATERIAL_INDEX) {
      material = groundMaterial;
    } else {
      material = getMaterial(hit.materialIndex);
    }

    float materialWeight = material.weight;
    vec3 surfaceColor = material.color.rgb;
    float diffuseAmount = 0.0;
    float specularHighlight = 0.0;
    float emission = 0.0;

    if (material.type == MATL_METAL) {
      colorMask *= surfaceColor;
      diffuseAmount = max(0.0, dot(jitteredLightDir, hit.normal));
      vec3 reflectedLight = normalize(reflect(jitteredLightDir - hit.pos, hit.normal));
      specularHighlight = max(0.0, dot(reflectedLight, normalize(hit.pos - ray.origin)));
      specularHighlight = materialWeight * material.specular * pow(specularHighlight, 3.0);
    }
    // Note: metal intentionally falls through to the final else as well —
    // this matches the original shader's behavior (and its known
    // "overdosing diffuse on metal" quirk) to keep golden parity.
    if (material.type == MATL_GLASS) {
      colorMask *= vec3(1.0) * materialWeight + (1.0 - materialWeight) * surfaceColor;
      diffuseAmount = (1.0 - materialWeight) * max(0.0, dot(jitteredLightDir, hit.normal));
    } else if (material.type == MATL_EMISSIVE) {
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
    if (neeEnabled == 1 && i > 0 && !gBounceSpecular && lightCount > 0 && emission > 0.0) {
      float pNee = (hit.t * hit.t) / float(lightCount);
      emission *= gBouncePdf / (gBouncePdf + pNee);
    }

    accumulatedColor += colorMask * diffuseAmount * shadowMultiplier;
    accumulatedColor += colorMask * specularHighlight * calibratedLightColor * shadowMultiplier;
    accumulatedColor += colorMask * emission;

    // Next-event estimation toward emissive voxels
    if (neeEnabled == 1 && tick != 0 && material.type != MATL_EMISSIVE) {
      float neeFactor = 1.0;
      if (material.type == MATL_GLASS || material.type == MATL_METAL) {
        // diffuse transport probability of these materials' bounce
        neeFactor = 1.0 - materialWeight;
      }
      accumulatedColor += colorMask * sampleEmissive(hit, neeFactor);
    }

    // The first frame is rendered without indirect lighting so something
    // shows up immediately.
    if (tick == 0) {
      break;
    }

    Ray newRay = bounceRay(ray, hit, material);
    if (newRay != ray) {
      ray = newRay;
    } else {
      break;
    }
  }

  // Ignore the first render since it is an interstitial render without
  // indirect lighting.
  int effectiveTick = tick > 1 ? tick - 1 : tick;
  float weight = 1.0 / float(effectiveTick + 1);
  vec4 previousColor = effectiveTick > 0 ? texelFetch(previousFrame, ivec2(gl_FragCoord.xy), 0) : vec4(0.0);
  fragColor = mix(previousColor, vec4(accumulatedColor, 1.0), weight);
}
