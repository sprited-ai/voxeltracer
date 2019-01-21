#pragma glslify: Ray = require('../Structs/Ray')
#pragma glslify: Model = require('../Structs/Model')
#pragma glslify: Hit = require('../Structs/Hit')
#pragma glslify: intersectModel = require('./intersectModel')

const float EPSILON = 0.0001;

/**
 * Cast Shadow
 */
float castShadow(vec3 pos, Model model, vec3 lightDir) {
    Ray ray = Ray(pos + lightDir * EPSILON, lightDir);
    Hit hit = intersectModel(ray, model);
    if (hit.didHit) {
        return 0.0;
    }
    return 1.0;
}

#pragma glslify: export(castShadow)
