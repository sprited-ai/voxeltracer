// iOS 12.1 (16B91) simulator has maximum 8 texture units.
// Since there are other textures involved, this number can not be large.
// If you need to render more, try using Metal in Swift.
const int MAX_MODEL_COUNT = 64;

#pragma glslify: export(MAX_MODEL_COUNT)
