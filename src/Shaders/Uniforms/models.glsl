#pragma glslify: MAX_MODEL_COUNT = require('../Constants/MAX_MODEL_COUNT')
#pragma glslify: Model = require('../Structs/Model')

uniform Model models[MAX_MODEL_COUNT];

#pragma glslify: export(models)
