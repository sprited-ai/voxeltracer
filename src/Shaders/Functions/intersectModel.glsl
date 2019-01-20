#pragma glslify: Ray = require('../Structs/Ray')
#pragma glslify: Hit = require('../Structs/Hit')
#pragma glslify: Model = require('../Structs/Model')
#pragma glslify: intersectBoundingBox = require('./intersectBoundingBox')

const float EPSILON = 0.0001;
const int ITERATION_LIMIT = 400;

/**
 * Intersect model
 */
Hit intersectModel(Ray ray, Model model) {
  vec3 boxMin = vec3(model.pos);
  vec3 boxMax = vec3(model.pos + model.size);

  // Intersect BB
  vec2 tBox = intersectBoundingBox(ray, boxMin, boxMax);

  if (tBox.x > tBox.y) {
    return Hit(false, 0.0, vec3(0), 0);
  }

  // The t for hitting bounding box
  float boxT = tBox.x;

  // Pick origin just short of intersection point
  vec3 origin = ray.origin + ray.dir * (boxT - EPSILON);

  // Origin from perspective of the grid (0, 0) position
  vec3 toOrigin = origin - boxMin;

  // Compute delta t
  vec3 deltaT = 1.0 / ray.dir * sign(ray.dir);

  // Get side offsetter
  vec3 side = step(0.0, ray.dir);

  // Find the first t set
  vec3 tSet = (floor(toOrigin) + side - toOrigin) / ray.dir;

  // Cell index (starts right outside of the bound)
  ivec3 cellIndex = ivec3(floor(toOrigin));

  // Normal
  vec3 hitNormal;

  // Hit T
  float hitT;

  for (int it = 0; it < ITERATION_LIMIT; ++it) {

    // Find minimum component of tSet
    float minT = min(tSet.x, min(tSet.y, tSet.z));

    if (tSet.x == minT) {
        tSet.x += deltaT.x;
        hitT = tSet.x;
        cellIndex.x += int(sign(ray.dir.x));
        hitNormal = vec3(-sign(ray.dir.x), 0.0, 0.0);
    }
    else if (tSet.y == minT) {
        tSet.y += deltaT.y;
        hitT = tSet.y;
        cellIndex.y += int(sign(ray.dir.y));
        hitNormal = vec3(0.0, -sign(ray.dir.y), 0.0);
    }
    else {
        tSet.z += deltaT.z;
        hitT = tSet.z;
        cellIndex.z += int(sign(ray.dir.z));
        hitNormal = vec3(0.0, 0.0, -sign(ray.dir.z));
    }

    // If some condition is met break from the loop (allow one extra padding)
    if (any(lessThan(cellIndex, ivec3(0) - 1)) || any(greaterThanEqual(cellIndex, ivec3(model.size) + 1))){
      break;
    }
    // If within bound, then texture lookup.
    else if (all(greaterThanEqual(cellIndex, ivec3(0))) && all(lessThan(cellIndex, ivec3(model.size)))) {

      if (cellIndex.y-cellIndex.y/2*2 == 1) {
        return Hit(true, hitT, hitNormal, 1);
      }
    }
  }

  return Hit(false, 0.0, vec3(0), 0);
}

#pragma glslify: export(intersectModel)
