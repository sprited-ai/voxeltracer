(function () {
'use strict';

/**
 * Voxelviewer
 * @author kndlt
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

  var gridSize = vec3.fromValues(4, 4, 4);

  var gridCenter = vec3.fromValues(2, 2, 2);

  var toLight = vec3.fromValues(0.5, 0.7, 1.0);

  // Normalize light direction
  toLight = vec3.normalize(toLight, toLight);

  var planeMesh = GL.Mesh.plane();

  // var cubeMesh = GL.Mesh.cube({ size: 16, wireframe: true });

  var flatShader = GL.Shader.getFlatShader();

  var voxelData = (function () {
    var data = new Uint8Array( gridSize[0] * gridSize[1] * gridSize[2] * 4 );
    for(var i = 0; i < data.length; ++i) {
      data[i] = Math.random() * 255;
    }
    return data;
  })();

  var voxelTexture = new GL.Texture(gridSize[0], gridSize[1], {
    depth: gridSize[2],
    texture_type: GL.TEXTURE_3D,
    format: gl.RGBA,
    magFilter: gl.NEAREST,
    pixel_data: voxelData
  });

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

  // Generic gl flags and settings
  // @TODO Might want this.
  // gl.enable( gl.DEPTH_TEST );

  gl.ondraw = function() {

    // @TODO Might not want this.
  	gl.clearColor(0.1,0.1,0.1,1);

  	// gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );

    // Set the camera position
    mat4.perspective(persp, 45 * DEG2RAD, gl.canvas.width / gl.canvas.height, 0.1, 1000);
    mat4.lookAt(view, [0,4,10],[0,0,0], [0,1,0]);

    // Create modelview and projection matrices
    mat4.multiply(temp, view, model);
  	mat4.multiply(mvp, persp, temp);

    // Get corner rays
    var w = gl.canvas.width;
    var h = gl.canvas.height;
    var tracer = new GL.Raytracer(mvp);
    voxelShader.uniforms({
      eye: tracer.eye,
      size: gridSize,
      center: gridCenter,
			voxelTexture: voxelTexture.bind(0),
      toLight: toLight,
      ray00: tracer.getRayForPixel(0, h),
      ray10: tracer.getRayForPixel(w, h),
      ray01: tracer.getRayForPixel(0, 0),
      ray11: tracer.getRayForPixel(w, 0)
    });

    // Trace the rays
    voxelShader.draw(planeMesh);

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

  var decoders = {
    150: {
      decode(buffer) {
        var version = readInt(buffer, 4);
        var mainChunk = this.decodeChunk(buffer, 8);
        debugger;
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
          var colorReader = uint8(buffer, contentStart, 4 * 256);
          var palette = [];
          for (var color_itr = 0; color_itr < 256; ++color_itr) {
            var color = {
              r: colorReader[4 * color_itr + 0],
              g: colorReader[4 * color_itr + 1],
              b: colorReader[4 * color_itr + 2],
              a: colorReader[4 * color_itr + 3],
            };
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
              chunk[this.props[i]] = readFloat(buffer, contentStart + 16 + propCounter * 4);
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
      }
    }
  };

  function loadFile(file) {
    // Check for the various File API support.
    if (!window.File || !window.FileReader || !window.FileList || !window.Blob) {
      alert('Bro, not supported.');
      return;
    }
    var reader = new FileReader();
    reader.onload = function(e) {
      var arrayBuffer = reader.result;
      var error = '';
      // @TODO Implement https://github.com/ephtracy/voxel-model/blob/master/MagicaVoxel-file-format-vox.txt
      if (readStr(arrayBuffer, 0, 4) !== 'VOX ') {
        error = 'Can\'t read... Is this *.vox file used in MagicaVoxel?';
        return;
      }
      var version = readInt(arrayBuffer, 4);

      var decoder = decoders[version];
      if (!decoder) {
        error = 'Ah, I don\'t have a decoder for version `${version}`.';
      }

      decoder.decode(arrayBuffer);

      if (error) {
        alert(error);
      }
    };
    reader.readAsArrayBuffer(file);
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
    var error = '';
    if (!files || files.length < 1) {
      error = 'Huh?'; // Unreachable.
    }
    else if (files.length > 1) {
      error = 'Just one please.';
    }
    else {
      var file = files[0];
      if (/\.vox$/i.test(file.name)) {
        loadFile(file);
      }
      else {
        error = 'Only vox files, ma\'am.';
      }
    }
    if (error) {
      alert(error);
    }
    hideDropZone();
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
}

main();

}());
//# sourceMappingURL=voxelviewer.js.map
