// Presents the latest accumulation texture to the canvas: a fullscreen
// triangle and a direct texel fetch (nearest, 1:1).

@group(0) @binding(0) var src: texture_2d<f32>;

@vertex
fn vs(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4f {
  var pos = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  return vec4f(pos[vi], 0.0, 1.0);
}

@fragment
fn fs(@builtin(position) p: vec4f) -> @location(0) vec4f {
  let size = textureDimensions(src);
  let q = clamp(vec2i(p.xy), vec2i(0), vec2i(size) - 1);
  return vec4f(textureLoad(src, q, 0).rgb, 1.0);
}
