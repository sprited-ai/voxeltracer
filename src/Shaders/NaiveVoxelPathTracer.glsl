precision highp float;
precision highp sampler2D;

#pragma glslify: Model = require('./Structs/Model')
#pragma glslify: Ray = require('./Structs/Ray')
#pragma glslify: Hit = require('./Structs/Hit')
#pragma glslify: Material = require('./Structs/Material')
#pragma glslify: castRay = require('./Functions/castRay')
#pragma glslify: getMaterial = require('./Functions/getMaterial')
#pragma glslify: cosineWeightedDirection = require('./Functions/cosineWeightedDirection')
#pragma glslify: uniformlyRandomVector = require('./Functions/uniformlyRandomVector')
#pragma glslify: castShadow = require('./Functions/castShadow')
#pragma glslify: jitterUV = require('./Functions/jitterUV')
#pragma glslify: jitterLightDir = require('./Functions/jitterLightDir')
#pragma glslify: intersectModels = require('./Functions/intersectModels')
#pragma glslify: getPreviousColor = require('./Functions/getPreviousColor')
#pragma glslify: MAX_MODEL_COUNT = require('./Constants/MAX_MODEL_COUNT')
#pragma glslify: MATL_DIFFUSE = require('./Constants/MATL_DIFFUSE');
#pragma glslify: MATL_METAL = require('./Constants/MATL_METAL');
#pragma glslify: MATL_GLASS = require('./Constants/MATL_GLASS');
#pragma glslify: MATL_EMISSIVE = require('./Constants/MATL_EMISSIVE');

varying vec2 uv;
uniform vec3 eye;
uniform vec3 lightDir;
uniform mat4 viewMatrixInverse;
uniform mat4 projectionMatrixInverse;
uniform Model models[MAX_MODEL_COUNT];
// uniform sampler2D previousFrameBuffer;
// uniform sampler2D colorPaletteTexture;
// uniform sampler2D colorTexture;
// uniform sampler2D materialTexture;
// uniform int modelCount;
// uniform sampler2D modelTexture0;
// uniform ivec3 modelPos;
// uniform ivec3 modelSize;
// uniform ivec2 modelTextureSize;
uniform int tick;
uniform int maxTick;
uniform ivec2 resolution;

// #pragma glslify: random = require('./Functions/random')

const float EPSILON = 0.0001;
const int BOUNCE_LIMIT = 2;

void main() {

  // Seed for random
  float normalizedSeed = float(tick) / float(maxTick);

  // Light zittering
  vec3 normalizedLightDir = normalize(lightDir);
  vec3 jitteredLightDir = jitterLightDir(normalizedLightDir, 0.314, normalizedSeed);

  // Anti-aliasing
  vec2 jitteredUV = tick == 0 ? uv : jitterUV(uv, tick, resolution);

  // Initial state
  Ray ray = castRay(eye, viewMatrixInverse, projectionMatrixInverse, jitteredUV);
  vec3 accumulatedColor = vec3(0.0);
  vec3 colorMask = vec3(1.0);

  // TODO: Bounce limit should be configurable by the user.
  for (int i = 0; i < BOUNCE_LIMIT + 1; ++i) {
    // Trace
    Hit hit = intersectModels(ray, models);

    // Break if no more hit
    if (!hit.didHit) break;

    // Shadow
    float shadowMultiplier = castShadow(hit.pos, models, jitteredLightDir);

    // Get material
    Material material = getMaterial(hit.materialIndex);

    // Diffuse
    float diffuseAmount = max(0.0, dot(jitteredLightDir, hit.normal));

    // Specular
    float specularHighlight = 0.0;
    if (material.type == MATL_METAL) {
      vec3 reflectedLight = normalize(reflect(jitteredLightDir - hit.pos, hit.normal));
      specularHighlight = max(0.0, dot(reflectedLight, normalize(hit.pos - ray.origin)));
      specularHighlight = material.specular * pow(specularHighlight, 3.0);
    }

    // Apply Color
    vec3 surfaceColor = material.color.rgb;
    colorMask *= surfaceColor;

    // Accumulate Colors
    // TODO: Verify mathmatical soundness.
    accumulatedColor += colorMask * diffuseAmount * shadowMultiplier;
    accumulatedColor += colorMask * specularHighlight * shadowMultiplier;

    // First slide will have no indirect lighting
    if (tick == 0) {
      break;
    }

    // Compute next ray
    float seed = (float(tick * 10) + float(i)) / 10000.0;
    ray.origin = hit.pos + ray.dir * EPSILON;

    // Metal bounce
    if (material.type == MATL_METAL) {
      ray.dir = normalize(reflect(ray.dir, hit.normal)) +
        uniformlyRandomVector(seed) * material.roughness;
    }
    // Diffuse bounce
    else {
      ray.dir = cosineWeightedDirection(seed, hit.normal);
    }


  }

  // Ignore first render since it is interstitial render without shadows.
  int effectiveTick = tick > 1 ? tick - 1 : tick;
  float weight = 1.0 / float(effectiveTick + 1);
  vec4 previousColor = effectiveTick > 0 ? getPreviousColor(uv) : vec4(0.0);
  vec4 finalColor = mix(previousColor, vec4(accumulatedColor, 1.0), weight);
  gl_FragColor = finalColor;
}



// TODO: Does this work???
// int subPixelCount = subPixelSideCount * subPixelSideCount;
// int subPixelIndex = mod(tick, subPixelCount);
// ivec2 subPixelIJ = ivec2(
//   mod(subPixelIndex, subPixelSideCount),
//   subPixelIndex / subPixelSideCount
// );
// vec2 subPixelLocalUV = (vec2(subPixelIJ) + 0.5) / float(subPixelSideCount);
// vec2 pixelPortion = 1.0 / vec2(resolution);
// vec2 subPixelUVOffset = pixelPortion * (subPixelLocalUV - 0.5);
//

// gl_FragColor = vec4(vec2(resolution) / 600.0, 0.0, 1.0); return;

// test
// float d = distance(subPixelLocalUV, uv);
// gl_FragColor = d < 0.05 ? vec4(1.0) : vec4(0.0, 0.0, 0.0, 1.0); return;

// test
// subPixelUV = uv;

// gl_FragColor = vec4(someData[0].colors[0].rgb, 1.0); return;
// vec4 texelValue = texture2D(someData[0].tex, uv);
// gl_FragColor = vec4(texelValue.rgb, 1.0); return;

// Debug UV
// gl_FragColor = vec4(uv, 0.0, 1.0); return;

// Color texture test
// vec4 texelValue = texture2D(colorTexture, uv);
// gl_FragColor = vec4(texelValue.rgb, 1.0); return;

// // Debug voxel texture.
// vec4 texelValue = texture2D(modelTexture0, vec2(uv.x, 1.0 - uv.y));
// gl_FragColor = vec4(
//     vec3(
//       (texelValue.r > 0.0 ? 1.0 : 0.0) +
//       (texelValue.g > 0.0 ? 1.0 : 0.0) +
//       (texelValue.b > 0.0 ? 1.0 : 0.0) +
//       (texelValue.a > 0.0 ? 1.0 : 0.0)
//     ) / 4.0
// , 1.0); return;

// Test
// gl_FragColor = vec4(float(model.textureSize.x) / 10.0, 0.0, 0.0, 1.0); return;

// Model model = models[1];

// // vec3 lightDir = normalize(vec3(-1.1, 1.9, -1.7));
// vec4 computedColor;
// if (hit.didHit) {

//   // Shadow ray
//   // float shadowMultiplier = tick == 0 ? 1.0 : castShadow(hit.pos, models, jitteredLightDir);
//   float shadowMultiplier = castShadow(hit.pos, models, jitteredLightDir);

//   // Material look up
//   int materialIndex = hit.materialIndex;
//   Material material = getMaterial(materialIndex);
//   vec3 color = material.color.rgb;
//   float lightMultiplier = max(dot(hit.normal, jitteredLightDir), 0.0);
//   float ambience = 0.2;
//   float intensity = (1.0 - ambience) * shadowMultiplier * lightMultiplier + ambience;
//   computedColor.rgb = color * intensity;
//   computedColor.a = 1.0;
// }
// else {
//   computedColor.rgb = (projectionMatrixInverse * vec4(ray.dir, 1.0)).rgb;
//   computedColor.a = 1.0;
// }

// vec3 accumulatedColor = vec3(0.0);
// vec3 colorMask = vec3(1.0);
// for (int jt = 0; jt < BOUNCE_LIMIT; ++jt) {
//     float hitT;
//     vec3 hitPoint;
//     vec3 normal;
//     int paletteIndex;
//     // Intersect
//     if (!intersectVoxels(ray, hitT, hitPoint, paletteIndex, normal)) {
//         break;
//     }
//     // Trace shadow
//     float shadowMultiplier = traceShadow(hitPoint);
//     // Compute Palette UV
//     vec2 uvPalette = vec2(
//         (mod(float(paletteIndex), 16.0) + 0.5) / 16.0,
//         (float(paletteIndex / 16) + 0.5) / 16.0
//     );
//     // Compute color
//     float diffuseAmount = max(0.0, dot(normalize(lightDirection), normal));
//     vec4 paletteValue = texture(paletteTexture, uvPalette);
//     vec3 surfaceColor = paletteValue.rgb;
//     colorMask *= surfaceColor;
//     accumulatedColor += colorMask * (diffuseAmount * shadowMultiplier);
//     float seed = timeSinceStart + float(jt);
//     ray.dir = cosineWeightedDirection(seed, normal);
//     ray.origin = hitPoint + ray.dir * EPSILON;
// }

// // Material texture test
// vec4 texelValue = texture2D(materialTexture, uv);
// gl_FragColor = vec4(texelValue.g, 0.0, 0.0, 1.0);
// return;

// Testing
// if (material.type != 1) {
//   diffuseAmount = 0.0;
// }

