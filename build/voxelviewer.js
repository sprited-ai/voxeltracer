(function () {
'use strict';

/**
 * Voxel Viewer
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

  var voxelData = (function () {
    var data = new Uint8Array( 2*2*2*4 );
    for(var i = 0; i < data.length; ++i) {
      data[i] = Math.random() * 255;
    }
    return data;
  })();
  var texture = new GL.Texture(2, 2, { depth: 2, texture_type: GL.TEXTURE_3D, format: gl.RGBA, magFilter: gl.NEAREST, pixel_data: voxelData } );

  var mesh = GL.Mesh.plane();
  var shader = new GL.Shader(`#version 300 es
    precision highp float;
    in vec3 a_vertex;
    in vec3 ray00;
    in vec3 ray10;
    in vec3 ray01;
    in vec3 ray11;
    out vec3 initialRay;
    void main() {
      vec2 t = a_vertex.xy * 0.5 + 0.5;
      initialRay = mix(mix(ray00, ray10, t.x), mix(ray01, ray11, t.x), t.y);

      initialRay = a_vertex;
      
      gl_Position = vec4(a_vertex, 1.0);
    }
  `, `#version 300 es
    precision highp float;
    precision highp sampler3D;
    uniform sampler3D u_texture;
    uniform vec3 eye;
    const float INFINITY = 1.0e9;
    const int ITERATION_LIMIT = 3 * 128;
    const ivec3 izero = ivec3(0);
    const ivec3 size = ivec3(2, 2, 2);   // @TODO Softcode this
    const ivec3 pos = ivec3(-1, 0, -1);  // @TODO Softcode this
    const vec3 toLight = vec3(-0.1, 1, 0.5);
    in vec3 initialRay;
    out vec4 outColor;
    void main() {
      vec3 origin = eye; // @TODO Does it get passed?
      vec3 ray = initialRay;
      vec4 color = vec4(0.0);
      ivec3 offset = 1 - ivec3(step(0.0, ray));
      ivec3 slab = offset * (size -1);


      // TESTING RAY DIRECTIONS
      outColor = vec4(ray+0.5, 1.0);

      // for (
      //   int i = 0; i < ITERATION_LIMIT; ++i
      // ) {
      //
      //   // color = vec4(vec3(slab) / 4.0, 1.0);
      //
      //   // Break out of the loop if end is reached.
      //   if (all(greaterThanEqual(slab, izero)) && all(lessThan(slab, size))) {
      //       // color = vec4(vec3(1.0 - float(i) / float(ITERATION_LIMIT)), 1.0);
      //       break;
      //   }
      //
      //   ivec3 normal, intersection;
      //   vec3 ts = (vec3(pos + slab + offset) - origin) / ray;
      //   float minT = min(ts.x, min(ts.y, ts.z));
      //
      //   // Compute normal and intersection
      //   if (ts.x == minT) {
      //     normal = ivec3(offset.x * 2 - 1);
      //     intersection = ivec3(
      //         slab.x,
      //         int(origin.y + ray.y * minT - float(pos.y)),
      //         int(origin.z + ray.z * minT - float(pos.z))
      //     );
      //     /* Test */ color = vec4(1.0, 0.0, 0.0, 1.0); break;
      //   }
      //   else if (ts.y == minT) {
      //     normal = ivec3(offset.y * 2 - 1);
      //     intersection = ivec3(
      //         int(origin.x + ray.x * minT - float(pos.x)),
      //         slab.y,
      //         int(origin.z + ray.z * minT - float(pos.z))
      //     );
      //     /* Test */ color = vec4(0.0, 1.0, 0.0, 1.0); break;
      //   }
      //   else if (ts.y == minT) {
      //     normal = ivec3(offset.z * 2 - 1);
      //     intersection = ivec3(
      //         int(origin.x + ray.x * minT - float(pos.x)),
      //         int(origin.y + ray.y * minT - float(pos.y)),
      //         slab.z
      //     );
      //     /* Test */ color = vec4(0.0, 0.0, 1.0, 1.0); break;
      //   }
      //   else {
      //     /* Test */ color = vec4(0.5, 0.5, 0.5, 1.0); break;
      //   }
      //
      //   if (
      //     minT > 0.0 &&
      //     all(greaterThanEqual(intersection, izero)) &&
      //     all(lessThan(intersection, size))
      //   ) {
      //     // Look up texture
      //     color = texture( u_texture, vec3(intersection) + vec3(0.5) );\
      //     break;
      //   }
      //
      //   slab -= normal;
      // }
      // outColor = color;
    }
  `);

  // // @TODO Testing code Remove this.
  // var shader = new Shader('\
  //   #version 300 es\n\
  //   precision highp float;\n\
  //   in vec3 a_vertex;\
  //   in vec3 a_normal;\
  //   in vec2 a_coord;\
  //   out vec3 v_pos;\
  //   out vec3 v_normal;\
  //   out vec2 v_coord;\
  //   uniform mat4 u_mvp;\
  //   uniform mat4 u_model;\
  //   void main() {\
  //     v_pos = (u_model * vec4(a_vertex,1.0)).xyz;\
  //     v_coord = a_coord;\
  //     v_normal = (u_model * vec4(a_normal,0.0)).xyz;\
  //     gl_Position = u_mvp * vec4(a_vertex,1.0);\
  //   }\
  //   ', '\
  //   #version 300 es\n\
  //   precision highp float;\n\
  //   precision highp sampler3D;\
  //   in vec3 v_pos;\n\
  //   in vec3 v_normal;\n\
  //   in vec2 v_coord;\
  //   out vec4 color;\
  //   uniform vec4 u_color;\
  //   uniform sampler3D u_texture;\
  //   void main() {\
  //     color = u_color * texture( u_texture, v_pos * 0.1 + vec3(0.5) );\
  //   }\
  // ');

  // @TODO Might need to be thrown away
  // gl.onmousemove = function(e) {
  //   if (e.dragging) {
  //     angleY += e.deltaX;
  //     angleX += e.deltaY;
  //     angleX = Math.max(-90, Math.min(90, angleX));
  //     gl.ondraw();
  //   }
  // };

  //create basic matrices for cameras and transformation
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
  // @TODO Might not want this.
  gl.clearColor(0.1,0.1,0.1,1);
  gl.enable( gl.DEPTH_TEST );

  gl.ondraw = function() {

    // @TODO Might not want this.
  	gl.clearColor(0.1,0.1,0.1,1);
  	gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );

    // Set the camera position
    mat4.perspective(persp, 45 * DEG2RAD, gl.canvas.width / gl.canvas.height, 0.1, 1000);
    mat4.lookAt(view, [0,20,20],[0,0,0], [0,1,0]);

    // Create modelview and projection matrices
    mat4.multiply(temp, view, model);
  	mat4.multiply(mvp, persp, temp);

    // Get corner rays
    var w = gl.canvas.width;
    var h = gl.canvas.height;
    var tracer = new GL.Raytracer(mvp);
    debugger;
    shader.uniforms({
      eye: tracer.eye,
			u_texture: texture.bind(0),
      ray00: tracer.getRayForPixel(0, h),
      ray10: tracer.getRayForPixel(w, h),
      ray01: tracer.getRayForPixel(0, 0),
      ray11: tracer.getRayForPixel(w, 0),
    });

    // Trace the rays
    shader.draw(mesh);
  };

  // Attach canvas
  var container = document.body;
  container.appendChild(gl.canvas);

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
