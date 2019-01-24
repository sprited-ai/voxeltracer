#pragma glslify: Material = require('../Structs/Material')
#pragma glslify: mod = require('../Functions/mod')

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
    vec4 color = texture2D(materialColorTexture, uv);
    return Material(color);
}

#pragma glslify: export(getMaterial)
