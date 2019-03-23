#pragma glslify: Ray = require('../Structs/Ray')
#pragma glslify: Hit = require('../Structs/Hit')
#pragma glslify: Model = require('../Structs/Model')
#pragma glslify: intersectModel = require('../Functions/intersectModel')
#pragma glslify: intersectGround = require('../Functions/intersectGround')
#pragma glslify: MAX_MODEL_COUNT = require('../Constants/MAX_MODEL_COUNT')
#pragma glslify: models = require('../Uniforms/models')

const Hit miss = Hit(false, 0.0, vec3(0.0), vec3(0.0), 0);

/**
 * Intersect models
 */
Hit intersectModels(Ray ray, int mediumIndex) {
  Hit nearestHit = miss;

  // Models
  for (int i = 0; i < MAX_MODEL_COUNT; ++i) {
    Model model = models[i];
    if (model.index == -1) continue;
    Hit hit = intersectModel(ray, model, mediumIndex);
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

#pragma glslify: export(intersectModels)
