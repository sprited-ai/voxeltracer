#pragma glslify: Model = require('../Structs/Model')
#pragma glslify: mod = require('../Functions/mod')

uniform sampler2D voxelTexture;

int voxelAt(Model model, ivec3 cellIndex) {
  // 4 stacks of y axis cross section in one slate.
  int slateIndex = cellIndex.y / 4;
  int sliceIndex = mod(cellIndex.y, 4);
  int numCols = model.textureSize.x / model.size.x;
  ivec2 slate = ivec2(mod(slateIndex, numCols), slateIndex / numCols);
  ivec2 slatePos = slate * model.size.xz;
  ivec2 texelPos = slatePos + cellIndex.xz;
  vec2 uv = (vec2(texelPos) + 0.5) / vec2(model.textureSize);
  vec4 slateValue = texture2D(voxelTexture, uv);
  float value;

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
