#pragma glslify: Ray = require('../Structs/Ray')
#pragma glslify: Model = require('../Structs/Model')
#pragma glslify: Hit = require('../Structs/Hit')
#pragma glslify: intersectModels = require('./intersectModels')

const float EPSILON = 0.0001;

/**
 * Cast Shadow
 */
float castShadow(vec3 pos, Model models[8], vec3 lightDir) {
    Ray ray = Ray(pos + lightDir * EPSILON, lightDir);
    Hit hit = intersectModels(ray, models);
    if (hit.didHit) {
        return 0.0;
    }
    return 1.0;
}

#pragma glslify: export(castShadow)
