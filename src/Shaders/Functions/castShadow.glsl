#pragma glslify: Ray = require('../Structs/Ray')
#pragma glslify: Hit = require('../Structs/Hit')
#pragma glslify: intersectShapes = require('./intersectShapes')

const float EPSILON = 0.0001;

/**
 * Cast Shadow
 */
float castShadow(vec3 pos, vec3 normal, vec3 lightDir) {

    float dotProduct = dot(normal, lightDir);
    if (dotProduct <= 0.0) {
      return 0.0;
    }
    Ray ray = Ray(pos - lightDir * EPSILON, lightDir);
    Hit hit = intersectShapes(ray, 0);
    if (hit.didHit) {
        return 0.0;
    }
    return 1.0;
}

#pragma glslify: export(castShadow)
