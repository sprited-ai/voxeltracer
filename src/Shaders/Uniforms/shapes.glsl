#pragma glslify: MAX_SHAPE_COUNT = require('../Constants/MAX_SHAPE_COUNT')
#pragma glslify: Shape = require('../Structs/Shape')

uniform Shape shapes[MAX_SHAPE_COUNT];

#pragma glslify: export(shapes)
