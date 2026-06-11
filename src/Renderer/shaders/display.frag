precision highp float;

uniform sampler2D srcTex;
out vec4 fragColor;

void main() {
  fragColor = vec4(texelFetch(srcTex, ivec2(gl_FragCoord.xy), 0).rgb, 1.0);
}
