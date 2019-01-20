precision highp float;
precision highp sampler2D;

uniform sampler2D voxelTexture;
uniform sampler2D paletteTexture;
uniform ivec2 voxelTextureSize;
varying vec2 uv;
uniform mat4 viewMatrixInverse;
uniform mat4 projectionMatrixInverse;
uniform vec3 eye;
uniform ivec3 modelPos;
uniform ivec3 modelSize;
uniform float progress;

#pragma glslify: Model = require('./Structs/Model')
#pragma glslify: Ray = require('./Structs/Ray')
#pragma glslify: Hit = require('./Structs/Hit')
#pragma glslify: castRay = require('./Functions/castRay')
#pragma glslify: intersectModel = require('./Functions/intersectModel')
// #pragma glslify: random = require('./Functions/random')

void main() {

  Model model = Model(ivec3(0), modelSize);

  Ray ray = castRay(eye, viewMatrixInverse, projectionMatrixInverse, uv);

  gl_FragColor = projectionMatrixInverse * vec4(ray.dir, 1.0);

  // float seed = progress;
  // float rand = random(vec3(12.9898, 78.233, 151.7182), seed);
  // gl_FragColor = vec4(rand, rand, rand, 1.0);
  // float n = random(uv);
  // gl_FragColor = vec4(vec3(n) + rand, 1.0);

  Hit hit = intersectModel(ray, model);

  if (hit.didHit) {
    gl_FragColor = vec4(vec3(1.0), 1.0);
  }
}
