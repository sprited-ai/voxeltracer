const int subPixelSideCount = 7;

vec2 jitterUV(vec2 uv, int tick, ivec2 resolution) {
  int subPixelCount = subPixelSideCount * subPixelSideCount;
  int subPixelIndex = mod(tick, subPixelCount);
  ivec2 subPixelIJ = ivec2(
    mod(subPixelIndex, subPixelSideCount),
    subPixelIndex / subPixelSideCount
  );
  vec2 subPixelLocalUV = (vec2(subPixelIJ) + 0.5) / float(subPixelSideCount);
  vec2 pixelPortion = 1.0 / vec2(resolution);
  vec2 subPixelUVOffset = pixelPortion * (subPixelLocalUV - 0.5);
  vec2 subPixelUV = uv + subPixelUVOffset;
  return subPixelUV;
}

#pragma glslify: export(jitterUV)
