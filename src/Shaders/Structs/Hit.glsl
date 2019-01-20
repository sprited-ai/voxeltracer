struct Hit {
  bool didHit;
  float t;
  vec3 normal;
  int paletteIndex;
};

#pragma glslify: export(Hit)
