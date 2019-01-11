/**
 * This random code is from https://github.com/evanw/webgl-path-tracing
 */
float random(vec3 scale, float seed) {
    return fract(sin(dot(vec3(100.0) + seed, scale)) * 43758.5453 + seed);
}

#pragma glslify: export(random)
