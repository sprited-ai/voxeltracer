#pragma glslify: random = require('glsl-random')

/**
 * Jitter Light direction for soft shadows.
 *
 * TODO: Zittering could be better. May be area light is better.
 * TODO: Theta is not used yet.
 */
vec3 jitterLightDir(vec3 dir, float theta, float normalizedSeed) {

  vec3 randomDir = normalize(vec3(
    random(vec2(normalizedSeed, 0.0)),
    random(vec2(normalizedSeed, 0.1)),
    random(vec2(normalizedSeed, 0.2))
  ) - 0.5);
  float distanceFactor = 0.05 *
    random(vec2(normalizedSeed, 0.3));
  return normalize(dir + (randomDir * distanceFactor));
}

#pragma glslify: export(jitterLightDir)
