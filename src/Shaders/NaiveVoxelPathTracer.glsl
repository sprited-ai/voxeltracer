precision highp float;
precision highp sampler2D;

#pragma glslify: Model = require('./Structs/Model')
#pragma glslify: Ray = require('./Structs/Ray')
#pragma glslify: Hit = require('./Structs/Hit')
#pragma glslify: Material = require('./Structs/Material')
#pragma glslify: castRay = require('./Functions/castRay')
#pragma glslify: getMaterial = require('./Functions/getMaterial')
#pragma glslify: castShadow = require('./Functions/castShadow')
#pragma glslify: zitterUV = require('./Functions/zitterUV')
#pragma glslify: intersectModels = require('./Functions/intersectModels')
#pragma glslify: getPreviousColor = require('./Functions/getPreviousColor')

varying vec2 uv;
uniform mat4 viewMatrixInverse;
uniform mat4 projectionMatrixInverse;
uniform vec3 eye;
uniform Model models[8];
// uniform sampler2D previousFrameBuffer;
// uniform sampler2D colorPaletteTexture;
// uniform sampler2D materialColorTexture;
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

const int subPixelSideCount = 5;

void main() {

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
  // vec4 texelValue = texture2D(materialColorTexture, uv);
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

  // Anti-aliasing
  vec2 zitteredUV = zitterUV(uv, tick, resolution);

  // Initial ray
  Ray ray = castRay(eye, viewMatrixInverse, projectionMatrixInverse, zitteredUV);

  // float seed = progress;
  // float rand = random(vec3(12.9898, 78.233, 151.7182), seed);
  // gl_FragColor = vec4(rand, rand, rand, 1.0);
  // float n = random(uv);
  // gl_FragColor = vec4(vec3(n) + rand, 1.0);

  Hit hit = intersectModels(ray, models);

  vec3 lightDir = normalize(vec3(-1.1, 1.9, -1.7));
  vec4 computedColor;
  if (hit.didHit) {

    // test depth.
    // gl_FragColor = vec4(hit.t * vec3(0.1), 1.0); return;

    // Shadow ray
    float shadowMultiplier;
    if (tick < 3) {
      // TODO: Use shadow map for first few
      shadowMultiplier = 1.0;
    } else {
      shadowMultiplier = castShadow(hit.pos, models, lightDir);
    }

    // Material look up
    int materialIndex = hit.materialIndex;
    Material material = getMaterial(materialIndex);
    vec3 color = material.color.rgb;
    float lightMultiplier = max(dot(hit.normal, lightDir), 0.0);
    float ambience = 0.2;
    float intensity = (1.0 - ambience) * shadowMultiplier * lightMultiplier + ambience;
    computedColor.rgb = color * intensity;
    computedColor.a = 1.0;
  }
  else {
    computedColor.rgb = (projectionMatrixInverse * vec4(ray.dir, 1.0)).rgb;
    computedColor.a = 1.0;
  }

  vec4 finalColor;
  if (tick == 0) {
    finalColor = computedColor;
  }
  else {
    vec4 previousColor = getPreviousColor(uv);
    // float progress = clamp(float(tick) / float(maxTick), 0.0, 1.0);
    float weight = 1.0 / float(tick + 1);
    finalColor = mix(previousColor, computedColor, weight);
  }

  gl_FragColor = finalColor;
}


