#pragma glslify: Ray = require('../Structs/Ray')
#pragma glslify: intersectBoundingBox = require('./intersectBoundingBox')

/**
 * Intersect model
 */
bool intersectModel(Ray ray, ivec3 size) {
    bool didHit = false;
    ivec3 boxMin = ivec3(0);
    ivec3 boxMax = size;
    vec2 ts;

    ts = intersectBoundingBox(ray, boxMin, boxMax);
    return ts.x < ts.y;
}

#pragma glslify: export(intersectModel)
