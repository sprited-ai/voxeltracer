#pragma glslify: Material = require('../Structs/Material')
#pragma glslify: mod = require('./mod')

uniform sampler2D materialColorTexture;

/**
 * Material look up
 */
Material getMaterial(int index) {
    ivec2 pos = ivec2(
      mod(index, 16),
      index / 16
    );
    vec2 uv = (vec2(pos) + 0.5) / 16.0;
    vec2 flippedUV = vec2(uv.x, 1.0 - uv.y);
    vec4 color = texture2D(materialColorTexture, flippedUV);
    return Material(color);
}

#pragma glslify: export(getMaterial)
