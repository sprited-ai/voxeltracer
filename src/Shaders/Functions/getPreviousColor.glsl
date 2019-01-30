uniform sampler2D previousFrameBuffer;

/**
 * Cast Shadow
 */
vec4 getPreviousColor(vec2 uv) {
  return texture2D(previousFrameBuffer, uv);
}

#pragma glslify: export(getPreviousColor)
