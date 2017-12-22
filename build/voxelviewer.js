(function () {
'use strict';

/**
 * Voxelviewer
 * @author kndlt
 *
 * Supported browsers (WebGL 1.0):
 *
 * - [ ] Edge 15+
 * - [x] Chrome 49+
 * - [ ] Chorme Android 62+
 * - [ ] Safari 10.2+
 * - [ ] iOS Safari 10.2+
 *
 * @TODO Display upgrade message when not compatible.
 * @TODO Need to downgrade to WebGL 1.0 in order to support other browsers.
 *     This means that we will need to pack voxel data into 2D texture.
 *     For 128^3 bytes (= ~ 2 mb), I need to construct, atlas texture.
 *     This will involve computing minimum power-2 sized image.
 *     One possible implementation is to take the 1-dimensional 3d texture
 *     data, and just get pow-2 square that will fit all that data,
 *     then load that 1-d data into it. This will disable all mipmapping,
 *     but might work. We have to try it.
 *
 */
function main() {

  var angleX = 30;
  var angleY = 10;
  var gl = GL.create({ version: 2 });

  if( gl.webgl_version != 2 || !gl )
  {
    alert("WebGL 2.0 not supported by your browser");
    return;
  }

  var toLight = vec3.fromValues(0.5, 0.7, 1.0);

  // Normalize light direction
  toLight = vec3.normalize(toLight, toLight);

  var planeMesh = GL.Mesh.plane();

  var loadedModel = null;

  // var cubeMesh = GL.Mesh.cube({ size: 16, wireframe: true });

  // var flatShader = GL.Shader.getFlatShader();

  var voxelShader = new GL.Shader(
    document.getElementById("shader-vs").text,
    document.getElementById("shader-fs").text
  );

  // Create basic matrices for cameras and transformation

  var persp = mat4.create();

  var view = mat4.create();

  var model = mat4.create();

  var mvp = mat4.create();

  var temp = mat4.create();

  var identity = mat4.create();

  // Get mouse actions
  gl.captureMouse();

  gl.onmousemove = function(e)
  {
  	if(e.dragging) {
      mat4.rotateY(model, model, e.deltax * 0.01);
    }
    gl.ondraw();
  };

  // GL pixel alignment for loading non-cubic textures.
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

  // Generic gl flags and settings
  // @TODO Might want this.
  // gl.enable( gl.DEPTH_TEST );

  gl.ondraw = function() {

    // @TODO Might not want this.
  	gl.clearColor(0.1,0.1,0.1,1);

  	// gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );

    // Set the camera position
    mat4.perspective(persp, 45 * DEG2RAD, gl.canvas.width / gl.canvas.height, 0.1, 1000);
    mat4.lookAt(view, [0,40,100],[0,0,0], [0,1,0]);

    // Create modelview and projection matrices
    mat4.multiply(temp, view, model);
  	mat4.multiply(mvp, persp, temp);

    // Get corner rays
    var w = gl.canvas.width;
    var h = gl.canvas.height;
    var tracer = new GL.Raytracer(mvp);

    if (loadedModel) {
      var size = loadedModel.size;
      voxelShader.uniforms({
        eye: tracer.eye,
        size: [size.x, size.y, size.z],
        center: [size.x / 2, size.y / 2, size.z / 2],
  			voxelTexture: loadedModel.voxelTexture.bind(0),
        paletteTexture: loadedModel.paletteTexture.bind(1),
        toLight: toLight,
        ray00: tracer.getRayForPixel(0, h),
        ray10: tracer.getRayForPixel(w, h),
        ray01: tracer.getRayForPixel(0, 0),
        ray11: tracer.getRayForPixel(w, 0)
      });

      // Trace the rays
      voxelShader.draw(planeMesh);
    }

    // // Bounding box overlay
		// flatShader.uniforms({
		// 	u_color: [1,1,1,1],
		// 	u_mvp: mvp
		// }).draw(cubeMesh, gl.LINES, "wireframe" );
  };

  /**
   * Bytes to String
   * Code is from Stack Overflow answer
   * https://stackoverflow.com/a/3195961
   */
  function b2s(array) {
    return String.fromCharCode.apply(String, array);
  }
  function uint8(buffer, byteOffset, length) {
    return new Uint8Array(buffer, byteOffset, length);
  }
  function uint32(buffer, byteOffset, length) {
    return new Uint32Array(buffer, byteOffset, length);
  }
  function int32(buffer, byteOffset, length) {
    return new Int32Array(buffer, byteOffset, length);
  }
  function float32(buffer, byteOffset, length) {
    return new Float32Array(buffer, byteOffset, length);
  }
  function readStr(arrayBuffer, byteOffset, length) {
    return b2s(uint8(arrayBuffer, byteOffset, length));
  }
  function readInt(arrayBuffer, byteOffset) {
    return int32(arrayBuffer, byteOffset)[0];
  }
  function readUint(arrayBuffer, byteOffset) {
    return uint32(arrayBuffer, byteOffset)[0];
  }
  function readFloat(arrayBuffer, byteOffset) {
    return float32(arrayBuffer, byteOffset)[0];
  }

  var defaultPalette = [
  	0x00000000, 0xffffffff, 0xffccffff, 0xff99ffff, 0xff66ffff, 0xff33ffff, 0xff00ffff, 0xffffccff, 0xffccccff, 0xff99ccff, 0xff66ccff, 0xff33ccff, 0xff00ccff, 0xffff99ff, 0xffcc99ff, 0xff9999ff,
  	0xff6699ff, 0xff3399ff, 0xff0099ff, 0xffff66ff, 0xffcc66ff, 0xff9966ff, 0xff6666ff, 0xff3366ff, 0xff0066ff, 0xffff33ff, 0xffcc33ff, 0xff9933ff, 0xff6633ff, 0xff3333ff, 0xff0033ff, 0xffff00ff,
  	0xffcc00ff, 0xff9900ff, 0xff6600ff, 0xff3300ff, 0xff0000ff, 0xffffffcc, 0xffccffcc, 0xff99ffcc, 0xff66ffcc, 0xff33ffcc, 0xff00ffcc, 0xffffcccc, 0xffcccccc, 0xff99cccc, 0xff66cccc, 0xff33cccc,
  	0xff00cccc, 0xffff99cc, 0xffcc99cc, 0xff9999cc, 0xff6699cc, 0xff3399cc, 0xff0099cc, 0xffff66cc, 0xffcc66cc, 0xff9966cc, 0xff6666cc, 0xff3366cc, 0xff0066cc, 0xffff33cc, 0xffcc33cc, 0xff9933cc,
  	0xff6633cc, 0xff3333cc, 0xff0033cc, 0xffff00cc, 0xffcc00cc, 0xff9900cc, 0xff6600cc, 0xff3300cc, 0xff0000cc, 0xffffff99, 0xffccff99, 0xff99ff99, 0xff66ff99, 0xff33ff99, 0xff00ff99, 0xffffcc99,
  	0xffcccc99, 0xff99cc99, 0xff66cc99, 0xff33cc99, 0xff00cc99, 0xffff9999, 0xffcc9999, 0xff999999, 0xff669999, 0xff339999, 0xff009999, 0xffff6699, 0xffcc6699, 0xff996699, 0xff666699, 0xff336699,
  	0xff006699, 0xffff3399, 0xffcc3399, 0xff993399, 0xff663399, 0xff333399, 0xff003399, 0xffff0099, 0xffcc0099, 0xff990099, 0xff660099, 0xff330099, 0xff000099, 0xffffff66, 0xffccff66, 0xff99ff66,
  	0xff66ff66, 0xff33ff66, 0xff00ff66, 0xffffcc66, 0xffcccc66, 0xff99cc66, 0xff66cc66, 0xff33cc66, 0xff00cc66, 0xffff9966, 0xffcc9966, 0xff999966, 0xff669966, 0xff339966, 0xff009966, 0xffff6666,
  	0xffcc6666, 0xff996666, 0xff666666, 0xff336666, 0xff006666, 0xffff3366, 0xffcc3366, 0xff993366, 0xff663366, 0xff333366, 0xff003366, 0xffff0066, 0xffcc0066, 0xff990066, 0xff660066, 0xff330066,
  	0xff000066, 0xffffff33, 0xffccff33, 0xff99ff33, 0xff66ff33, 0xff33ff33, 0xff00ff33, 0xffffcc33, 0xffcccc33, 0xff99cc33, 0xff66cc33, 0xff33cc33, 0xff00cc33, 0xffff9933, 0xffcc9933, 0xff999933,
  	0xff669933, 0xff339933, 0xff009933, 0xffff6633, 0xffcc6633, 0xff996633, 0xff666633, 0xff336633, 0xff006633, 0xffff3333, 0xffcc3333, 0xff993333, 0xff663333, 0xff333333, 0xff003333, 0xffff0033,
  	0xffcc0033, 0xff990033, 0xff660033, 0xff330033, 0xff000033, 0xffffff00, 0xffccff00, 0xff99ff00, 0xff66ff00, 0xff33ff00, 0xff00ff00, 0xffffcc00, 0xffcccc00, 0xff99cc00, 0xff66cc00, 0xff33cc00,
  	0xff00cc00, 0xffff9900, 0xffcc9900, 0xff999900, 0xff669900, 0xff339900, 0xff009900, 0xffff6600, 0xffcc6600, 0xff996600, 0xff666600, 0xff336600, 0xff006600, 0xffff3300, 0xffcc3300, 0xff993300,
  	0xff663300, 0xff333300, 0xff003300, 0xffff0000, 0xffcc0000, 0xff990000, 0xff660000, 0xff330000, 0xff0000ee, 0xff0000dd, 0xff0000bb, 0xff0000aa, 0xff000088, 0xff000077, 0xff000055, 0xff000044,
  	0xff000022, 0xff000011, 0xff00ee00, 0xff00dd00, 0xff00bb00, 0xff00aa00, 0xff008800, 0xff007700, 0xff005500, 0xff004400, 0xff002200, 0xff001100, 0xffee0000, 0xffdd0000, 0xffbb0000, 0xffaa0000,
  	0xff880000, 0xff770000, 0xff550000, 0xff440000, 0xff220000, 0xff110000, 0xffeeeeee, 0xffdddddd, 0xffbbbbbb, 0xffaaaaaa, 0xff888888, 0xff777777, 0xff555555, 0xff444444, 0xff222222, 0xff111111
  ];

  var decoders = {
    // Implementation of  https://github.com/ephtracy/voxel-model/blob/master/MagicaVoxel-file-format-vox.txt
    150: {
      decode(buffer) {
        var version = readInt(buffer, 4);
        var mainChunk = this.decodeChunk(buffer, 8);
        var model = this.generateModel(mainChunk);
        return model;
      },
      props: [
        'plastic',     // bit(0)
        'roughness',   // bit(1)
        'specular',    // bit(2)
        'ior',         // bit(3)
        'attenuation', // bit(4)
        'power',       // bit(5)
        'glow',        // bit(6)
        'isTotalPower' // bit(7)
      ],
      decodeChunk(buffer, chunkStart) {
        var chunkId = readStr(buffer, chunkStart, 4);
        var numBytesOfChunkContent = readInt(buffer, chunkStart + 4);
        var numBytesOfChildrenChunks = readInt(buffer, chunkStart + 8);
        var contentStart = chunkStart + 12;
        var childrenStart = contentStart + numBytesOfChunkContent;
        var chunkSize = 12 + numBytesOfChunkContent + numBytesOfChildrenChunks;
        var chunk = {
          id: chunkId,
          size: chunkSize
        };

        if (chunkId === 'PACK') {
          chunk.numModels = readInt(buffer, contentStart);
        }
        else if (chunkId === 'SIZE') {
          chunk.x = readInt(buffer, contentStart);
          chunk.y = readInt(buffer, contentStart + 4);
          chunk.z = readInt(buffer, contentStart + 8);
        }
        else if (chunkId === 'XYZI') {
          var numVoxels = chunk.numVoxels = readInt(buffer, contentStart);
          var voxelReader = uint8(buffer, contentStart + 4, 4 * numVoxels);
          var voxels = [];
          for (var voxelItr = 0; voxelItr < numVoxels; ++voxelItr) {
            var voxel = {
              x: voxelReader[4 * voxelItr + 0],
              y: voxelReader[4 * voxelItr + 1],
              z: voxelReader[4 * voxelItr + 2],
              colorIndex: voxelReader[4 * voxelItr + 3],
            };
            voxels.push(voxel);
          }
          chunk.voxels = voxels;
        }
        else if (chunkId === 'RGBA') {
          var colorReader = uint32(buffer, contentStart, 256);
          var palette = [];
          for (var color_itr = 0; color_itr < 256; ++color_itr) {
            var color = colorReader[color_itr];
            palette.push(color);
          }
          chunk.palette = palette;
        }
        else if (chunkId === 'MATT') {
          chunk.colorIndex = readInt(buffer, contentStart);
          chunk.materialType = readInt(buffer, contentStart + 4);
          chunk.materialWeight = readFloat(buffer, contentStart + 8);
          var propBits = readUint(buffer, contentStart + 12);
          var propCounter = 0;
          for (var propItr = 0; propItr < this.props.length; ++propItr) {
            var bitMask = 1 << propItr;
            if (propBits & bitMask) {
              chunk[this.props[propItr]] = readFloat(buffer, contentStart + 16 + propCounter * 4);
              ++propCounter;
            }
          }
        }

        var numBytesOfChildrenChunksRead = 0;
        var children = [];
        while (numBytesOfChildrenChunksRead < numBytesOfChildrenChunks) {
          var childChunk = this.decodeChunk(buffer,
            childrenStart + numBytesOfChildrenChunksRead
          );
          children.push(childChunk);
          numBytesOfChildrenChunksRead += childChunk.size;
        }

        if (children.length) {
          chunk.children = children;
        }

        return chunk;
      },

      /* Load the model file
       *
       *         {
       *           size: { x, y, z },                   // Size
       *           voxelData: <Uint8Array>,             // Palette indices
       *           paletteData: <Uint32Array>,          // RGBAs
       *           error: { code, message },            // Optional
       *           warnings: [{ code, message }]        // Optional
       *           // @TODO Materials
       *         }
       *
       */
      generateModel: function (mainChunk) {
        var children = mainChunk.children;
        var packChunk = children[0].id === 'PACK' ? children[0] : null;
        var numModels = packChunk ? packChunk.numModels : 1;
        var offset = packChunk ? 1 : 0;
        var warnings = [];
        var error;
        if (numModels === 0) {
            error = {
              code: 'NO_MODEL',
              message: '0 model found.'
            };
            return { error: error };
        }
        if (numModels > 1) {
            warnings.push({
              code: 'MULTI_MODEL',
              message: 'More than one model found. Loading first one only.'
            });
        }

        // Load first model only (have not seen usecase of 2 or more models).
        var sizePack = children[offset];
        var xyziPack = children[offset + 1];

        if (sizePack.id !== 'SIZE') {
          error = {
            code: 'NO_SIZE',
            message: 'SIZE pack not found.'
          };
          return { error: error };
        }

        if (xyziPack.id !== 'XYZI') {
          error = {
            code: 'NO_XYZI',
            message: 'XYZI pack not found.'
          };
          return { error: error };
        }

        // Load size
        var size = {
          x: sizePack.x,
          y: sizePack.z,
          z: sizePack.y
        };

        // Load voxel data
        var voxels = xyziPack.voxels;
        var voxelData = new Uint8Array(size.x * size.y * size.z);
        for (var voxelI = 0; voxelI < voxels.length; ++voxelI) {
            var voxel = voxels[voxelI];
            voxelData[voxel.x + size.x * voxel.z + size.x * size.y * (size.z - voxel.y - 1)] =
              voxel.colorIndex;
        }

        // Load palette
        var rgbaPack = children.find((pack) => pack.id === 'RGBA');
        var palette = rgbaPack ? rgbaPack.palette : null;
        var paletteData = palette ?
          new Uint32Array(256) :
          new Uint32Array(defaultPalette);

        if (palette) {
          // Note that color [0-254] are mapped to palette index [1-255]
          for (var paletteI =0; paletteI < 255; ++paletteI) {
            paletteData[paletteI + 1] = palette[paletteI];
          }
        }

        var model = {
          size: size,
          voxelData: voxelData,
          paletteData: new Uint8Array(paletteData.buffer)
        };

        if (warnings.length) {
          model.warnings = warnings;
        }
        return model;
      }
    }
  };

  function loadFile(file) {
    return new Promise((resolve) => {
      var reader = new FileReader();
      reader.onload = function(e) {
        var arrayBuffer = reader.result;

        if (readStr(arrayBuffer, 0, 4) !== 'VOX ') {
          resolve({
            error : {
              code: 'INVALID_FILE',
              message: 'Can\'t read... Is this *.vox file used in MagicaVoxel?'
            }
          });
          return;
        }

        var version = readInt(arrayBuffer, 4);

        var decoder = decoders[version];
        if (!decoder) {
          resolve({
            error : {
              code: 'INVALID_VERSION',
              message: 'Version not supported.'
            }
          });
          return;
        }

        var model = decoder.decode(arrayBuffer);
        resolve(model);
      };
      reader.readAsArrayBuffer(file);
    });
  }

  function loadModel(model) {
    // Clean up
    if (loadedModel) {
      delete loadedModel.voxelTexture;
      delete loadedModel.paletteTexture;
    }

    // X first, then Y, then Z
    model.voxelTexture = new GL.Texture(model.size.x, model.size.y, {
      depth: model.size.z,
      texture_type: GL.TEXTURE_3D,
      format: gl.ALPHA,
      internalFormat: gl.ALPHA,
      magFilter: gl.NEAREST,
      pixel_data: model.voxelData
    });

    model.paletteTexture = new GL.Texture(16, 16, {
      magFilter: gl.NEAREST,
      pixel_data: model.paletteData
    });

    loadedModel = model;
    gl.ondraw();
  }

  // Attach canvas
  var container = document.getElementById('canvas-container');
  var dropZone = document.getElementById('drop-zone');
  var dropInstruction= document.getElementById('drop-instruction');
  var dropError= document.getElementById('drop-error');
  var rollingEyes = document.getElementById('rolling-eyes');

  container.appendChild(gl.canvas);

  function showDropZone(instruction, error) {
    dropZone.setAttribute('hidden', 'false');
    dropZone.setAttribute('error', error ? 'true' : 'false');
    dropInstruction.innerHTML = instruction;
    dropError.innerHTML = error;
  }

  function hideDropZone() {
    dropZone.setAttribute('hidden', 'true');
    dropInstruction.innerHTML = '';
    dropError.innerHTML = '';
  }

  // Allow dropping
  function allowDrop(evt) {
    evt.preventDefault();
    var items = evt.dataTransfer.items;
    var instruction = ''; // No instruction needed.
    var error = '';
    if (!items || items.length > 1) {
      error = 'Just one, please';
    }
    showDropZone(instruction, error);
  }


  // Hanlder for droping voxel files
  function handleDrop(evt) {

    evt.preventDefault();
    var files = evt.dataTransfer.files;

    var dropPromise = new Promise((resolve) => {
      if (!files || files.length < 1) {
        resolve({
            error : {
              code: 'NO_FILE',
              message: 'Huh?'
            }
        });
      }
      else if (files.length > 1) {
        resolve({
            error : {
              code: 'MULTI_FILE',
              message: 'Just one please.'
            }
        });
      }
      else {
        var file = files[0];
        var loadPromise = loadFile(file);
        loadPromise.then((model) => {
            hideDropZone();
            if (model.error) {
                resolve({ error: model.error });
                return;
            }
            loadModel(model);
        });
      }
    }).then((result ) => {
        if (result && result.error) {
            alert(result.error.message);
        }
    });
  }

  // Drop zone
  gl.canvas.addEventListener('dragend', hideDropZone);
  gl.canvas.addEventListener('dragover', allowDrop);
  gl.canvas.addEventListener('drop', handleDrop);

  // On resize
  function resize() {
    gl.canvas.width = window.innerWidth;
    gl.canvas.height = window.innerHeight;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.ondraw();
  }

  window.addEventListener('resize', resize);

  resize();

  // Load placeholder model.
  var placeholderModel = (function(x, y, z){
    return {
      size: { x: x, y: y, z: z },
      voxelData: (function () {
        var data = new Uint8Array( x * y * z );
        for(var i = 0; i < data.length; ++i) {
          data[i] = Math.random() > 0.5 ? 0 : Math.random() * 255;
        }
        return data;
      })(),
      paletteData: (function () {
        var data = new Uint8Array( 256 * 4 );
        for(var i = 0; i < data.length; ++i) {
          data[i] = Math.random() * 255;
        }
        return data;
      })()
    };
  })(5, 5, 5);
  loadModel(placeholderModel);
}

main();

}());
//# sourceMappingURL=voxelviewer.js.map
