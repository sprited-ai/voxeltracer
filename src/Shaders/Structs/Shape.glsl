struct Shape {
  int modelIndex;
  int byteOffset;
  mat3 rotation;
  ivec3 translation;
  ivec3 size;
  ivec3 pos;
};

#pragma glslify: export(Shape)
