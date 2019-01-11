precision highp float;
precision highp sampler2D;

uniform sampler2D voxelTexture;
uniform sampler2D paletteTexture;
varying vec2 uv;
uniform mat4 viewMatrixInverse;
uniform mat4 projectionMatrixInverse;
uniform vec3 eye;
uniform ivec3 modelSize;
uniform float progress;

#pragma glslify: Ray = require('./Structs/Ray')
#pragma glslify: intersectModel = require('./Functions/intersectModel')
#pragma glslify: random = require('./Functions/random')

void main() {

  // Test UV.
  // gl_FragColor = vec4(uv.x, uv.y, 0.0, 1.0);return;

  // TODO Optimize by pre-computing matrices or initial rays itself
  //
  vec4 q = viewMatrixInverse * projectionMatrixInverse * vec4((uv - 0.5) * 2.0, 1.0, 1.0);
  vec3 rayDirection = normalize(q.xyz / q.w - eye);
  Ray ray = Ray(eye, rayDirection);


  gl_FragColor = projectionMatrixInverse * vec4(rayDirection, 1.0);

  // float seed = progress;
  // float rand = random(vec3(12.9898, 78.233, 151.7182), seed);
  // gl_FragColor = vec4(rand, rand, rand, 1.0);
  // float n = random(uv);
  // gl_FragColor = vec4(vec3(n) + rand, 1.0);

  if(intersectModel(ray, modelSize)) {
    gl_FragColor = vec4(vec3(1), 1.0);
  }
}
