struct Hit {
  bool didHit;
  float t;
  vec3 pos;
  vec3 normal;
  int paletteIndex;
};

#pragma glslify: export(Hit)
