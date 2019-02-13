#pragma glslify: random = require('./random')
#pragma glslify: uniformlyRandomDirection = require('./uniformlyRandomDirection')

/**
 * This code is from https://github.com/evanw/webgl-path-tracing
 */
vec3 uniformlyRandomVector(float seed) {
    return uniformlyRandomDirection(seed) * sqrt(random(vec3(36.7539, 50.3658, 306.2759), seed));
}

#pragma glslify: export(uniformlyRandomVector)
