#pragma glslify: Material = require('../Structs/Material')
#pragma glslify: mod = require('./mod')
#pragma glslify: MATL_DIFFUSE = require('../Constants/MATL_DIFFUSE');
#pragma glslify: MATL_METAL = require('../Constants/MATL_METAL');
#pragma glslify: MATL_GLASS = require('../Constants/MATL_GLASS');
#pragma glslify: MATL_EMISSIVE = require('../Constants/MATL_EMISSIVE');

uniform sampler2D colorTexture;
uniform sampler2D materialTexture;

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
    vec4 color = texture2D(colorTexture, flippedUV);
    vec4 options = texture2D(materialTexture, flippedUV);

    int type = int(options.r * 255.0);
    float weight = 0.0;
    float roughness = 0.0;
    float specular = 0.0;
    float refraction = 0.0;
    float flux = 0.0;
    float glow = 0.0;

    // Metal
    if (type == MATL_METAL) {
      weight = options.g;
      roughness = options.b;
      specular = options.a;
    }
    // Glass
    else if (type == MATL_GLASS) {
      weight = options.g;
      roughness = options.b;
      refraction = options.a;
    }
    // Emissive
    else if (type == MATL_EMISSIVE) {
      weight = options.g;
      flux = options.b;
      glow = options.a;
    }

    return Material(
      type,
      color,
      weight,
      roughness,
      specular,
      refraction,
      flux,
      glow
    );
}

#pragma glslify: export(getMaterial)
