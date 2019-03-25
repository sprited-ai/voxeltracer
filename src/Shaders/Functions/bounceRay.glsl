#pragma glslify: Ray = require('../Structs/Ray')
#pragma glslify: Material = require('../Structs/Material')
#pragma glslify: Hit = require('../Structs/Hit')
#pragma glslify: MATL_DIFFUSE = require('../Constants/MATL_DIFFUSE');
#pragma glslify: MATL_METAL = require('../Constants/MATL_METAL');
#pragma glslify: MATL_GLASS = require('../Constants/MATL_GLASS');
#pragma glslify: MATL_EMISSIVE = require('../Constants/MATL_EMISSIVE');
#pragma glslify: random = require('glsl-random');
#pragma glslify: cosineWeightedDirection = require('./cosineWeightedDirection')
#pragma glslify: fresnel = require('./fresnel')
#pragma glslify: uniformlyRandomVector = require('./uniformlyRandomVector')
#pragma glslify: intersectShapes = require('./intersectShapes')

const float EPSILON = 0.0001;

/**
 * Bounce Ray
 * Returns new ray if we were able to bounce or refract.
 * Otherwise, we return the same exact ray back.
 */
Ray bounceRay(Ray ray, Hit hit, Material material, float seed) {
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
  // TODO: Internal reflection
  // TODO: Roughness through sub surface scattering
  else if (material.type == MATL_GLASS && r < weight) {
    float ior = 1.0 + material.refraction;
    float fresnelReflectance = fresnel(1.0 / ior, ray.dir, hit.normal);
    float fresnelRandom = random(vec2(seed, 0.5));

    // Refraction
    // TODO: Calibrate
    if (fresnelRandom > fresnelReflectance) {
      ray.dir = refract(ray.dir, hit.normal, 1.0 / ior) + uniformlyRandomVector(seed) * material.roughness * 0.08;
      ray.origin = hit.pos + ray.dir * EPSILON;
      Hit exitHit = intersectShapes(ray, hit.materialIndex);
      if (exitHit.didHit) {
        ray.dir = refract(ray.dir, exitHit.normal, ior);
        ray.origin = exitHit.pos - ray.dir * EPSILON;
      }
      else {
        // TODO: Implement this edge case.
      }
    }
    // Fresnel reflection
    else {
      ray.dir = normalize(reflect(ray.dir, hit.normal)) + uniformlyRandomVector(seed) * material.roughness;
      ray.origin = hit.pos + ray.dir * EPSILON;
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
