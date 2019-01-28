precision highp float;
precision highp sampler2D;

#pragma glslify: Model = require('./Structs/Model')
#pragma glslify: Ray = require('./Structs/Ray')
#pragma glslify: Hit = require('./Structs/Hit')
#pragma glslify: Material = require('./Structs/Material')
#pragma glslify: castRay = require('./Functions/castRay')
#pragma glslify: getMaterial = require('./Functions/getMaterial')
#pragma glslify: castShadow = require('./Functions/castShadow')
#pragma glslify: intersectModels = require('./Functions/intersectModels')

varying vec2 uv;
uniform mat4 viewMatrixInverse;
uniform mat4 projectionMatrixInverse;
uniform vec3 eye;
uniform Model models[8];
// uniform sampler2D colorPaletteTexture;
// uniform sampler2D materialColorTexture;
// uniform int modelCount;
// uniform sampler2D modelTexture0;
// uniform ivec3 modelPos;
// uniform ivec3 modelSize;
// uniform ivec2 modelTextureSize;
uniform float progress;

// #pragma glslify: random = require('./Functions/random')

const float EPSILON = 0.0001;

void main() {

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

  Ray ray = castRay(eye, viewMatrixInverse, projectionMatrixInverse, uv);

  // float seed = progress;
  // float rand = random(vec3(12.9898, 78.233, 151.7182), seed);
  // gl_FragColor = vec4(rand, rand, rand, 1.0);
  // float n = random(uv);
  // gl_FragColor = vec4(vec3(n) + rand, 1.0);

  Hit hit = intersectModels(ray, models);

  vec3 lightDir = normalize(vec3(-1.1, 1.9, -1.7));

  if (hit.didHit) {

    // test depth.
    // gl_FragColor = vec4(hit.t * vec3(0.1), 1.0); return;

    // Shadow ray
    float shadowMultiplier = castShadow(hit.pos, models, lightDir);

    // Material look up
    int materialIndex = hit.materialIndex;
    Material material = getMaterial(materialIndex);
    vec3 color = material.color.rgb;
    float lightMultiplier = max(dot(hit.normal, lightDir), 0.0);
    float ambience = 0.2;
    float intensity = (1.0 - ambience) * shadowMultiplier * lightMultiplier + ambience;
    gl_FragColor.rgb = color * intensity;
    gl_FragColor.a = 1.0;
  }
  else {
    gl_FragColor = projectionMatrixInverse * vec4(ray.dir, 1.0);
  }
}
