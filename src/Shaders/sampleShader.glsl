precision highp float;

varying vec2 uv;
uniform mat4 matrixWorldInverse;
uniform mat4 projectionMatrixInverse;
uniform vec3 eye;

#pragma glslify: random = require('glsl-random')
#pragma glslify: customRandom = require('./Functions/random')

void main() {
  // // TODO Optimize by pre-computing matrices or initial rays itself
  // vec4 q = matrixWorldInverse * projectionMatrixInverse * vec4((uv - 0.5) * 2.0, 0.0, 1.0);
  // vec3 initialRay = normalize(q.xyz / q.w - eye);
  // gl_FragColor = projectionMatrixInverse * vec4(initialRay * 255.0, 1.0);

  float rand = customRandom(vec3(12.9898, 78.233, 151.7182), uv.x);
  // gl_FragColor = vec4(rand, rand, rand, 1.0);

  float n = random(uv);
  gl_FragColor = vec4(vec3(n) + rand, 1.0);
}
