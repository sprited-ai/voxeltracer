#pragma glslify: Ray = require('../Structs/Ray')
#pragma glslify: Hit = require('../Structs/Hit')
#pragma glslify: Shape = require('../Structs/Shape')
#pragma glslify: intersectShape = require('../Functions/intersectShape')
#pragma glslify: intersectGround = require('../Functions/intersectGround')
#pragma glslify: MAX_SHAPE_COUNT = require('../Constants/MAX_SHAPE_COUNT')
#pragma glslify: shapes = require('../Uniforms/shapes')

const Hit miss = Hit(false, 0.0, vec3(0.0), vec3(0.0), 0);

/**
 * Intersect shapes
 */
Hit intersectShapes(Ray ray, int mediumIndex) {
  Hit nearestHit = miss;

  // Shapes
  for (int i = 0; i < MAX_SHAPE_COUNT; ++i) {
    Shape shape = shapes[i];
    if (shape.modelIndex == -1) continue;
    Hit hit = intersectShape(ray, shape, mediumIndex);
    if (hit.didHit) {
      if (!nearestHit.didHit || hit.t < nearestHit.t) {
        nearestHit = hit;
      }
    }
  }

  // Ground
  Hit groundHit = intersectGround(ray);
  if (groundHit.didHit) {
    if (!nearestHit.didHit || groundHit.t < nearestHit.t) {
      nearestHit = groundHit;
    }
  }

  return nearestHit;
}

#pragma glslify: export(intersectShapes)
