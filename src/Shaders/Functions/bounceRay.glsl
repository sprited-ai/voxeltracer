#pragma glslify: Ray = require('../Structs/Ray')
#pragma glslify: Material = require('../Structs/Material')
#pragma glslify: Hit = require('../Structs/Hit')
#pragma glslify: MATL_DIFFUSE = require('../Constants/MATL_DIFFUSE');
#pragma glslify: MATL_METAL = require('../Constants/MATL_METAL');
#pragma glslify: MATL_GLASS = require('../Constants/MATL_GLASS');
#pragma glslify: MATL_EMISSIVE = require('../Constants/MATL_EMISSIVE');
#pragma glslify: random = require('glsl-random');
#pragma glslify: cosineWeightedDirection = require('./cosineWeightedDirection')
#pragma glslify: uniformlyRandomVector = require('./uniformlyRandomVector')

const float EPSILON = 0.0001;

/**
 * Bounce Ray
 */
Ray bounceRay(Ray ray, Hit hit, Material material, float seed) {
  // Material bounce chance
  bool didBounce = false;
  float bounceRandom = random(vec2(seed, 0.5));
  if (bounceRandom < material.weight) {
    // Metal bounce
    if (material.type == MATL_METAL) {
      ray.dir = normalize(reflect(ray.dir, hit.normal)) +
        uniformlyRandomVector(seed) * material.roughness;
        didBounce = true;
    }
    // Glass penetration
    else if (material.type == MATL_GLASS) {
      // TODO: Refract
      didBounce = true;
    }
  }
  // Default diffuse bounce logic
  if (!didBounce) {
    ray.dir = cosineWeightedDirection(seed, hit.normal);
  }

  // New ray origin
  ray.origin = hit.pos + ray.dir * EPSILON;

  return ray;
}

#pragma glslify: export(bounceRay)
