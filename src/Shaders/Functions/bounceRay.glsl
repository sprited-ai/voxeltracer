#pragma glslify: Ray = require('../Structs/Ray')
#pragma glslify: Material = require('../Structs/Material')
#pragma glslify: Model = require('../Structs/Model')
#pragma glslify: Hit = require('../Structs/Hit')
#pragma glslify: MAX_MODEL_COUNT = require('../Constants/MAX_MODEL_COUNT')
#pragma glslify: MATL_DIFFUSE = require('../Constants/MATL_DIFFUSE');
#pragma glslify: MATL_METAL = require('../Constants/MATL_METAL');
#pragma glslify: MATL_GLASS = require('../Constants/MATL_GLASS');
#pragma glslify: MATL_EMISSIVE = require('../Constants/MATL_EMISSIVE');
#pragma glslify: random = require('glsl-random');
#pragma glslify: cosineWeightedDirection = require('./cosineWeightedDirection')
#pragma glslify: uniformlyRandomVector = require('./uniformlyRandomVector')
#pragma glslify: intersectModels = require('./intersectModels')

const float EPSILON = 0.0001;

/**
 * Bounce Ray
 * Returns new ray if we were able to bounce or refract.
 * Otherwise, we return the same exact ray back.
 */
Ray bounceRay(Ray ray, Hit hit, Material material, Model[MAX_MODEL_COUNT] models, float seed) {
  // Material bounce chance
  bool didBounce = false;
  float r = random(vec2(seed, 0.5));
  float weight = material.weight;
  // Metal bounce
  if (material.type == MATL_METAL && r < weight) {
    ray.dir = normalize(reflect(ray.dir, hit.normal)) + uniformlyRandomVector(seed) * material.roughness;
    ray.origin = hit.pos + ray.dir * EPSILON;
  }
  // Glass refraction or reflection
  // TODO: Fresnel reflection
  // TODO: Roughness through sub surface scattering
  else if (material.type == MATL_GLASS && r < weight) {
    float ior = 1.0 + material.refraction;
    ray.dir = refract(ray.dir, hit.normal, 1.0 / ior) + uniformlyRandomVector(seed) * material.roughness * 0.05;
    ray.origin = hit.pos + ray.dir * EPSILON;
    Hit exitHit = intersectModels(ray, models, hit.materialIndex);
    if (exitHit.didHit) {
      ray.dir = refract(ray.dir, exitHit.normal, ior);
      ray.origin = exitHit.pos - ray.dir * EPSILON;
    }
  }
  // Default diffuse bounce logic
  else {
    ray.dir = cosineWeightedDirection(seed, hit.normal);
    ray.origin = hit.pos + ray.dir * EPSILON;
  }

  return ray;
}

#pragma glslify: export(bounceRay)
