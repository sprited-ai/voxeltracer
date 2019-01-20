#pragma glslify: Ray = require('../Structs/Ray')

/**
 * Cast Ray
 */
Ray castRay(vec3 eye, mat4 viewMatrixInverse, mat4 projectionMatrixInverse, vec2 uv) {
  vec4 q = viewMatrixInverse * projectionMatrixInverse * vec4((uv - 0.5) * 2.0, 1.0, 1.0);
  vec3 rayDirection = normalize(q.xyz / q.w - eye);
  return Ray(eye, rayDirection);
}

#pragma glslify: export(castRay)
