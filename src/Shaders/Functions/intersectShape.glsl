#pragma glslify: Ray = require('../Structs/Ray')
#pragma glslify: Hit = require('../Structs/Hit')
#pragma glslify: Shape = require('../Structs/Shape')
#pragma glslify: mod = require('../Functions/mod')
#pragma glslify: voxelAt = require('../Functions/voxelAt')
#pragma glslify: intersectBoundingBox = require('./intersectBoundingBox')
#pragma glslify: shapes = require('../Uniforms/shapes')
#pragma glslify: transpose = require('glsl-transpose')

const float EPSILON = 0.0001;
const int ITERATION_LIMIT = 400;
const Hit miss = Hit(false, 0.0, vec3(0.0), vec3(0.0), 0);

/**
 * Intersect shape
 */
Hit intersectShape(Ray ray, Shape shape, int mediumIndex) {
  vec3 boxMin = vec3(shape.pos);
  vec3 boxMax = vec3(shape.pos + shape.size);

  // Keep original ray
  Ray originalRay = ray;

  // Transform ray using inverse model transformation.
  // Model = Translation * Rotation
  // inverse(Model) = inverse(Rotation) * inverse(Translation)
  // where inverse(Rotation) = transpose(Rotation) since it is orthogonal.
  // TODO: Check the performance of transposing a 3x3 matrix.
  mat3 inverseRotation = transpose(shape.rotation);
  ray.dir = inverseRotation * ray.dir;
  ray.origin = inverseRotation * (ray.origin - vec3(shape.translation));

  // Intersect BB
  vec2 tBox = intersectBoundingBox(ray, boxMin, boxMax);
  float near = tBox.x;
  float far = tBox.y;
  vec3 origin;

  // Ray originates from with in the bounding box.
  if (near <= 0.0 && far > 0.0) {
    origin = ray.origin;
  }
  // On-route
  else if (near > 0.0 && far > near) {
    origin = ray.origin + ray.dir * (near - EPSILON);
  }
  // No intersection
  else {
    return miss;
  }

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
  vec3 normal;

  // Hit T
  float hitT = 0.0;

  for (int it = 0; it < ITERATION_LIMIT; ++it) {

    // Find minimum component of tSet
    float minT = min(tSet.x, min(tSet.y, tSet.z));

    if (tSet.x == minT) {
        tSet.x += deltaT.x;
        cellIndex.x += int(sign(ray.dir.x));
        normal = vec3(-sign(ray.dir.x), 0.0, 0.0);
    }
    else if (tSet.y == minT) {
        tSet.y += deltaT.y;
        cellIndex.y += int(sign(ray.dir.y));
        normal = vec3(0.0, -sign(ray.dir.y), 0.0);
    }
    else {
        tSet.z += deltaT.z;
        cellIndex.z += int(sign(ray.dir.z));
        normal = vec3(0.0, 0.0, -sign(ray.dir.z));
    }

    // If some condition is met break from the loop (allow one extra padding)
    if (any(lessThan(cellIndex, ivec3(0) - 1)) || any(greaterThanEqual(cellIndex, ivec3(shape.size) + 1))){
      break;
    }
    // If within bound, then texture lookup.
    else if (all(greaterThanEqual(cellIndex, ivec3(0))) && all(lessThan(cellIndex, ivec3(shape.size)))) {

      // Check voxel
      int materialIndex = voxelAt(shape.size, shape.byteOffset, cellIndex);

      // Consider it a hit if exiting current medium (i.e. vacuum or glass)
      if (materialIndex != mediumIndex) {
        vec3 voxMin = vec3(cellIndex + shape.pos);
        vec3 voxMax = voxMin + 1.0;
        vec2 tVox = intersectBoundingBox(ray, voxMin, voxMax);
        float hitT = tVox.x;
        vec3 hitPos = originalRay.origin + originalRay.dir * hitT;
        vec3 hitNormal = shape.rotation * normal;
        return Hit(true, hitT, hitPos, hitNormal, materialIndex);
      }
    }
  }

  return miss;
}

#pragma glslify: export(intersectShape)
