#pragma glslify: Ray = require('../Structs/Ray')
#pragma glslify: Model = require('../Structs/Model')
#pragma glslify: Hit = require('../Structs/Hit')
#pragma glslify: intersectModels = require('./intersectModels')
#pragma glslify: MAX_MODEL_COUNT = require('../Constants/MAX_MODEL_COUNT')

const float EPSILON = 0.0001;

/**
 * Cast Shadow
 */
float castShadow(vec3 pos, vec3 normal, Model models[MAX_MODEL_COUNT], vec3 lightDir) {

    float dotProduct = dot(normal, lightDir);
    if (dotProduct <= 0.0) {
      return 0.0;
    }
    Ray ray = Ray(pos + lightDir * EPSILON, lightDir);
    Hit hit = intersectModels(ray, models);
    if (hit.didHit) {
        return 0.0;
    }
    return 1.0;
}

#pragma glslify: export(castShadow)
