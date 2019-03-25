#pragma glslify: mod = require('../Functions/mod')

uniform sampler2D packedTexture;
uniform ivec2 packedTextureSize;

int voxelAt(ivec3 size, int byteOffset, ivec3 cellIndex) {
  int index = byteOffset + cellIndex.z * size.y * size.x + cellIndex.y * size.x + cellIndex.x;
  // Note that packed texture has x, y flipped.
  ivec2 texelPos = ivec2(
    (index / 4) / packedTextureSize.x,
    mod(index / 4, packedTextureSize.x)
  );
  int componentIndex = mod(index, 4);
  vec2 uv = (vec2(texelPos) + 0.5) / vec2(packedTextureSize);
  vec2 flippedUV = vec2(uv.x, 1.0 - uv.y);
  vec4 texelValue;
  float value;
  texelValue = texture2D(packedTexture, flippedUV);
  // Select the right slice
  if (componentIndex == 0) {
    value = texelValue.r;
  }
  else if (componentIndex == 1) {
    value = texelValue.g;
  }
  else if (componentIndex == 2) {
    value = texelValue.b;
  }
  else {
    value = texelValue.a;
  }
  return int(value * 255.0);
}

#pragma glslify: export(voxelAt)
