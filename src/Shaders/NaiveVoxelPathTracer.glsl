precision highp float;
precision highp sampler2D;

uniform sampler2D modelTexture;
uniform sampler2D paletteTexture;
varying vec2 uv;
uniform mat4 viewMatrixInverse;
uniform mat4 projectionMatrixInverse;
uniform vec3 eye;
uniform ivec3 modelPos;
uniform ivec3 modelSize;
uniform ivec2 modelTextureSize;
uniform float progress;

#pragma glslify: Model = require('./Structs/Model')
#pragma glslify: Ray = require('./Structs/Ray')
#pragma glslify: Hit = require('./Structs/Hit')
#pragma glslify: castRay = require('./Functions/castRay')
#pragma glslify: castShadow = require('./Functions/castShadow')
#pragma glslify: intersectModel = require('./Functions/intersectModel')
// #pragma glslify: random = require('./Functions/random')

const float EPSILON = 0.0001;

void main() {

  // Debug texture.
  // gl_FragColor = vec4(1.0,0.0,0.0,1.0); return;
  vec4 texelValue = texture2D(modelTexture, uv);
  gl_FragColor = vec4(texelValue.rgb, 1.0); return;


  Model model = Model(0, -modelSize/2, modelSize, modelTextureSize);

  Ray ray = castRay(eye, viewMatrixInverse, projectionMatrixInverse, uv);

  // float seed = progress;
  // float rand = random(vec3(12.9898, 78.233, 151.7182), seed);
  // gl_FragColor = vec4(rand, rand, rand, 1.0);
  // float n = random(uv);
  // gl_FragColor = vec4(vec3(n) + rand, 1.0);

  Hit hit = intersectModel(ray, model);

  vec3 lightDir = normalize(vec3(-1.1, 1.9, -1.7));

  if (hit.didHit) {

    // test depth.
    // gl_FragColor = vec4(hit.t * vec3(0.1), 1.0); return;

    // Shadow ray
    float shadowMultiplier = castShadow(hit.pos, model, lightDir);

    vec3 color = vec3(1.0);
    float lightMultiplier = max(dot(hit.normal, lightDir), 0.0);
    float ambience = 0.2;
    gl_FragColor.rgb = (1.0 - ambience) * color * shadowMultiplier * lightMultiplier + ambience;
    gl_FragColor.a = 1.0;
  }
  else {
    gl_FragColor = projectionMatrixInverse * vec4(ray.dir, 1.0);
  }
}
