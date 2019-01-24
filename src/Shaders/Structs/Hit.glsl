struct Hit {
  bool didHit;
  float t;
  vec3 pos;
  vec3 normal;
  int materialIndex;
};

#pragma glslify: export(Hit)
