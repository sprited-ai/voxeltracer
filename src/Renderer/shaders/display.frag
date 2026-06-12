precision highp float;

uniform sampler2D srcTex;
in vec2 uv;
out vec4 fragColor;

void main() {
  // uv-based fetch so a low-res interactive preview upscales to the canvas
  ivec2 size = textureSize(srcTex, 0);
  ivec2 p = clamp(ivec2(uv * vec2(size)), ivec2(0), size - 1);
  fragColor = vec4(texelFetch(srcTex, p, 0).rgb, 1.0);
}
