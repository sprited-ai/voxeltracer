#pragma glslify: uniformlyRandomVector = require('./uniformlyRandomVector')

/**
 * Jitter Light direction for soft shadows.
 *
 * TODO: Zittering could be better. May be area light is better.
 * TODO: Theta is not used yet.
 */
vec3 jitterLightDir(vec3 dir, float theta, float seed) {
  vec3 randomDir = uniformlyRandomVector(seed);
  return normalize(dir + randomDir * 0.05);
}

#pragma glslify: export(jitterLightDir)
