#pragma glslify: Ray = require('../Structs/Ray')
#pragma glslify: Hit = require('../Structs/Hit')
#pragma glslify: intersectBoundingBox = require('./intersectBoundingBox')

const Hit miss = Hit(false, 0.0, vec3(0.0), vec3(0.0), 0);

// TODO make this a uniform
const int groundMaterialIndex = 1;

/**
 * Intersect models
 */
Hit intersectGround(Ray ray) {

  vec3 groundMin = vec3(-100000.0);
  vec3 groundMax = vec3(100000.0, 0, 100000.0);
  vec2 tBox = intersectBoundingBox(ray, groundMin, groundMax);
  float tNear = tBox.x;
  float tFar = tBox.y;

  if (tNear > 0.0 && tFar > tNear) {
    vec3 hitPos = ray.origin + ray.dir * tNear;
    return Hit(true, tNear, hitPos, vec3(0, 1, 0), groundMaterialIndex);
  }
  else {
    return miss;
  }
}

#pragma glslify: export(intersectGround)
