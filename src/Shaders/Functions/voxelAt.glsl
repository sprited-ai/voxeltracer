#pragma glslify: Model = require('../Structs/Model')
#pragma glslify: mod = require('../Functions/mod')

uniform sampler2D modelTexture0;
uniform sampler2D modelTexture1;
uniform sampler2D modelTexture2;
uniform sampler2D modelTexture3;
uniform sampler2D modelTexture4;
uniform sampler2D modelTexture5;
uniform sampler2D modelTexture6;
uniform sampler2D modelTexture7;

int voxelAt(Model model, ivec3 cellIndex) {
  // 4 stacks of y axis cross section in one slate.
  int slateIndex = cellIndex.y / 4;
  int sliceIndex = mod(cellIndex.y, 4);
  int numCols = model.textureSize.x / model.size.x;
  ivec2 slate = ivec2(mod(slateIndex, numCols), slateIndex / numCols);
  ivec2 slatePos = slate * model.size.xz;
  ivec2 texelPos = slatePos + cellIndex.xz;
  vec2 uv = (vec2(texelPos) + 0.5) / vec2(model.textureSize);
  vec2 flippedUV = vec2(uv.x, 1.0 - uv.y);
  vec4 slateValue;
  float value;

  // Select the right texture
  if (model.index == 0) {
    slateValue = texture2D(modelTexture0, flippedUV);
  }
  else if (model.index == 1) {
    slateValue = texture2D(modelTexture1, flippedUV);
  }
  else if (model.index == 2) {
    slateValue = texture2D(modelTexture2, flippedUV);
  }
  else if (model.index == 3) {
    slateValue = texture2D(modelTexture3, flippedUV);
  }
  else if (model.index == 4) {
    slateValue = texture2D(modelTexture4, flippedUV);
  }
  else if (model.index == 5) {
    slateValue = texture2D(modelTexture5, flippedUV);
  }
  else if (model.index == 6) {
    slateValue = texture2D(modelTexture6, flippedUV);
  }
  else {
    slateValue = texture2D(modelTexture7, flippedUV);
  }

  // Select the right slice
  if (sliceIndex == 0) {
    value = slateValue.r;
  }
  else if (sliceIndex == 1) {
    value = slateValue.g;
  }
  else if (sliceIndex == 2) {
    value = slateValue.b;
  }
  else {
    value = slateValue.a;
  }

  return int(value * 255.0);
}

#pragma glslify: export(voxelAt)
