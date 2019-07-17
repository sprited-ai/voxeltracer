#pragma glslify: Ray = require('../Structs/Ray')
#pragma glslify: Hit = require('../Structs/Hit')
#pragma glslify: GROUND_MATERIAL_INDEX = require('../Constants/GROUND_MATERIAL_INDEX')
#pragma glslify: intersectBoundingBox = require('./intersectBoundingBox')

const Hit miss = Hit(false, 0.0, vec3(0.0), vec3(0.0), 0);

/**
 * Intersect ground
 */
Hit intersectGround(Ray ray) {

  vec3 groundMin = vec3(-100000.0);
  vec3 groundMax = vec3(100000.0, 0, 100000.0);
  vec2 tBox = intersectBoundingBox(ray, groundMin, groundMax);
  float tNear = tBox.x;
  float tFar = tBox.y;

  if (tNear > 0.0 && tFar > tNear) {
    vec3 hitPos = ray.origin + ray.dir * tNear;
    return Hit(true, tNear, hitPos, vec3(0, 1, 0), GROUND_MATERIAL_INDEX);
  }
  else {
    return miss;
  }
}

#pragma glslify: export(intersectGround)
