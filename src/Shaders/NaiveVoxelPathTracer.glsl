precision highp float;
precision highp sampler2D;

uniform sampler2D voxelTexture;
uniform sampler2D paletteTexture;
varying vec2 uv;
uniform mat4 matrixWorldInverse;
uniform mat4 projectionMatrixInverse;
uniform vec3 eye;
uniform float progress;

#pragma glslify: random = require('./Functions/random')

void main() {
  // // TODO Optimize by pre-computing matrices or initial rays itself
  // vec4 q = matrixWorldInverse * projectionMatrixInverse * vec4((uv - 0.5) * 2.0, 0.0, 1.0);
  // vec3 initialRay = normalize(q.xyz / q.w - eye);
  // gl_FragColor = projectionMatrixInverse * vec4(initialRay * 255.0, 1.0);
  float seed = progress;
  float rand = random(vec3(12.9898, 78.233, 151.7182), seed);
  gl_FragColor = vec4(rand, rand, rand, 1.0);

  // float n = random(uv);
  // gl_FragColor = vec4(vec3(n) + rand, 1.0);
}
