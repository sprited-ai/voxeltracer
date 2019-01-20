#pragma glslify: Ray = require('../Structs/Ray')

/**
 * Axis-aligned bounding box intersection.
 *
 *
 *         origin ·│
 *                 * tMin.x=1
 *                 │·
 *                 │ ·
 *                 │  · tMin.y=5      x
 *   ──────────────┌───*───┬───────┐────→
 *                 │    ·  │       │
 *                 │     · │       │
 *                 ├──────·┼───────┤
 *                 │       ·       │
 *                 │       │·      │
 *                 └───────┴─*─────┘
 *                 │tMax.y=11 ·    |
 *                 │           ·   |
 *               y ↓            ·  |
 *                               · |
 *                                ·|
 *                                 * tMax.x=17
 *
 *
 *         tMin = (1, 5)   tMax = (17, 11)
 *         t1 = (1, 5)     t2 = (17, 11)
 *         tNear = 5       tFar = 11
 */
vec2 intersectBoundingBox(Ray ray, vec3 boxMin, vec3 boxMax) {
  vec3 tMin = (boxMin - ray.origin) / ray.dir;
  vec3 tMax = (boxMax - ray.origin) / ray.dir;
  vec3 t1 = min(tMin, tMax);
  vec3 t2 = max(tMin, tMax);
  float tNear = max(max(t1.x, t1.y), t1.z);
  float tFar = min(min(t2.x, t2.y), t2.z);
  return vec2(tNear, tFar);
}

#pragma glslify: export(intersectBoundingBox)
