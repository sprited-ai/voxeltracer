
// Reference: https://drive.google.com/file/d/0B8g97JkuSSBwUENiWTJXeGtTOHFmSm51UC01YWtCZw/view
float fresnel(float eta, vec3 incident, vec3 normal) {
  float f0 = ((eta - 1.0) * (eta - 1.0)) / ((eta + 1.0) * (eta + 1.0));
  float fr = f0 + (1.0 - f0) * pow(1.0 - dot(normal, -incident), 5.0);
  return fr;
}

#pragma glslify: export(fresnel)
