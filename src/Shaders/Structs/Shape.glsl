struct Shape {
  int modelIndex;
  int byteOffset;
  mat4 transform;
  ivec3 size;
  ivec3 pos;
};

#pragma glslify: export(Shape)
