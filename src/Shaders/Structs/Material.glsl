struct Material {
  int type;
  vec4 color;
  float weight;
  float roughness;
  float specular;
  float refraction;
  float flux;
  float glow;
};

#pragma glslify: export(Material)
