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

  var voxelData = (function () {
    var data = new Uint8Array( 2*2*2*4 );
    for(var i = 0; i < data.length; ++i) {
      data[i] = Math.random() * 255;
    }
    return data;
  })();

  var texture = new GL.Texture(2, 2, { depth: 2, texture_type: GL.TEXTURE_3D, format: gl.RGBA, magFilter: gl.NEAREST, pixel_data: voxelData } );
  var planeMesh = GL.Mesh.plane();
  var cubeMesh = GL.Mesh.cube({ size: 2, wireframe: true });
  var flatShader = GL.Shader.getFlatShader();
  var voxelShader = new GL.Shader(`#version 300 es
    precision highp float;
    uniform vec3 ray00;
    uniform vec3 ray10;
    uniform vec3 ray01;
    uniform vec3 ray11;
    in vec3 a_vertex;
    out vec3 initialRay;
    void main() {
      vec2 t = a_vertex.xy + 0.5;
      initialRay = mix(mix(ray00, ray10, t.x), mix(ray01, ray11, t.x), t.y);
      gl_Position = vec4(a_vertex * 2.0, 1.0);
    }
  `, `#version 300 es
    precision highp float;
    precision highp sampler3D;
    uniform sampler3D u_texture;
    uniform vec3 eye;
    const float INFINITY = 1.0e9;
    const int ITERATION_LIMIT = 3 * 16; // @TODO Softcode this
    const ivec3 izero = ivec3(0);
    const ivec3 size = ivec3(2, 2, 2);   // @TODO Softcode this
    const ivec3 pos = ivec3(-1, -1, -1);  // @TODO Softcode this
    const vec3 toLight = normalize(vec3(0.5, 0.7, 1.0));
    const ivec3 x_axis = ivec3(1, 0 , 0);
    const ivec3 y_axis = ivec3(0, 1 , 0);
    const ivec3 z_axis = ivec3(0, 0 , 1);
    in vec3 initialRay;
    out vec4 outColor;
    vec4 intersectAxis(vec3 origin, vec3 ray, ivec3 pos, ivec3 slab, ivec3 offset, ivec3 axis) {
      vec3 intersection = vec3(0);
      float t = 0.0;
      vec3 ts = (vec3(pos + slab + offset) - origin) / ray;
      if (dot(ray, vec3(axis)) != 0.0) {
        t = dot(ts, vec3(axis));
        intersection = (origin + ray * t - vec3(pos)) * vec3(1 - axis) + vec3(slab * axis);
      }
      return vec4(intersection, t);
    }
    float intersectSlabs(vec3 origin, vec3 ray, ivec3 pos, ivec3 slab, ivec3 offset, out vec3 hit, out vec3 normal) {
      float hitT = INFINITY;
      vec4 intersection;
      ivec3 axis;
      axis = x_axis; intersection = intersectAxis(origin, ray, pos, slab, offset, axis); if (all(greaterThanEqual(intersection, vec4(0.0))) && all(lessThan(vec4(intersection), vec4(size, hitT)))) { hitT = intersection.w; hit = intersection.xyz; normal = vec3((offset * 2 - 1) * axis); }
      axis = y_axis; intersection = intersectAxis(origin, ray, pos, slab, offset, axis); if (all(greaterThanEqual(intersection, vec4(0.0))) && all(lessThan(vec4(intersection), vec4(size, hitT)))) { hitT = intersection.w; hit = intersection.xyz; normal = vec3((offset * 2 - 1) * axis); }
      axis = z_axis; intersection = intersectAxis(origin, ray, pos, slab, offset, axis); if (all(greaterThanEqual(intersection, vec4(0.0))) && all(lessThan(vec4(intersection), vec4(size, hitT)))) { hitT = intersection.w; hit = intersection.xyz; normal = vec3((offset * 2 - 1) * axis); }
      return hitT;
    }
    void main() {

      // // For testing ray directions
      // outColor = vec4(initialRay * 0.5 + 0.5, 1.0); return;

      vec3 origin = eye; // @TODO Does it get passed?
      vec3 ray = initialRay;
      vec3 color = vec3(0.0);
      ivec3 offset = 1 - ivec3(step(0.0, ray));
      ivec3 slab = offset * (size - 1);

      // outColor = vec4(vec3(eye), 0.0);return;

      for (int i = 0; i < ITERATION_LIMIT; ++i) {

        // Break out of the loop if end is reached.
        if (any(lessThan(slab, izero)) || any(greaterThanEqual(slab, size))) {
            break;
        }

        vec3 hit, normal;
        float hitT = intersectSlabs(origin, ray, pos, slab, offset, hit, normal);

        if (hitT < INFINITY) {
          // Look up texture
          vec4 voxelColor = texture( u_texture, hit / vec3(size));
          color = voxelColor.xyz * dot(normal, toLight);
          break;
        }

        // if (hitT != INFINITY) {
        //     outColor = vec4(vec3(normal), 1.0);
        // }
        // return;

        // vec3 ts = (vec3(pos + slab + offset) - origin) / ray;
        // axis = x_axis;
        // if (dot(ray, vec3(axis)) != 0.0) {
        //   t = dot(ts, vec3(axis));
        //   intersection =
        //     ivec3(origin + ray * t - vec3(pos)) * (1 - axis) + slab * axis;
        //   if(
        //     t < hitT &&
        //     all(greaterThanEqual(intersection, izero)) &&
        //     all(lessThan(intersection, size))
        //   ) {
        //     hitT = t;
        //     hit = intersection;
        //     normal = (offset * 2 - 1) * axis;
        //   }
        // }
        // axis = y_axis;
        // if (dot(ray, vec3(axis)) != 0.0) {
        //   t = dot(ts, vec3(axis));
        //   intersection =
        //     ivec3(origin + ray * t - vec3(pos)) * (1 - axis) + slab * axis;
        //   if(
        //     t < hitT &&
        //     all(greaterThanEqual(intersection, izero)) &&
        //     all(lessThan(intersection, size))
        //   ) {
        //     hitT = t;
        //     hit = intersection;
        //     normal = (offset * 2 - 1) * axis;
        //   }
        // }
        // axis = z_axis;
        // if (dot(ray, vec3(axis)) != 0.0) {
        //   t = dot(ts, vec3(axis));
        //   intersection =
        //     ivec3(origin + ray * t - vec3(pos)) * (1 - axis) + slab * axis;
        //   if(
        //     t < hitT &&
        //     all(greaterThanEqual(intersection, izero)) &&
        //     all(lessThan(intersection, size))
        //   ) {
        //     hitT = t;
        //     hit = intersection;
        //     normal = (offset * 2 - 1) * axis;
        //   }
        // }
        //
        // if (hitT != INFINITY) {
        //     outColor = vec4(1.0);
        // }
        // return;



        // vec3 ts = (vec3(pos + slab + offset) - origin) / ray;
        // float minT = min(ts.x, min(ts.y, ts.z));
        //
        // // outColor = vec4(ts / 100.0 + 0.5, 0.0);return;
        //
        // // Compute normal and intersection
        // if (ts.x == minT) {
        //   normal = ivec3(offset.x * 2 - 1, 0, 0);
        //   intersection = ivec3(
        //       slab.x,
        //       int(origin.y + ray.y * minT - float(pos.y)),
        //       int(origin.z + ray.z * minT - float(pos.z))
        //   );
        //   // /* Test */ color = vec4(1.0, 0.0, 0.0, 1.0); break;
        // }
        // else if (ts.y == minT) {
        //   normal = ivec3(0, offset.y * 2 - 1, 0);
        //   intersection = ivec3(
        //       int(origin.x + ray.x * minT - float(pos.x)),
        //       slab.y,
        //       int(origin.z + ray.z * minT - float(pos.z))
        //   );
        //   // /* Test */ color = vec4(0.0, 1.0, 0.0, 1.0); break;
        // }
        // else if (ts.z == minT) {
        //   normal = ivec3(0, 0, offset.z * 2 - 1);
        //   intersection = ivec3(
        //       int(origin.x + ray.x * minT - float(pos.x)),
        //       int(origin.y + ray.y * minT - float(pos.y)),
        //       slab.z
        //   );
        //   // /* Test */ color = vec4(0.0, 0.0, 1.0, 1.0); break;
        // }
        //
        // if (
        //   minT > 0.0 &&
        //   all(greaterThanEqual(intersection, izero)) &&
        //   all(lessThan(intersection, size))
        // ) {
        //   // Look up texture
        //   color = vec4(intersection, 1.0);
        //   // color = texture( u_texture, vec3(intersection) + vec3(0.5) );\
        //   break;
        // }
        //
        // slab -= normal;
      }
      outColor = vec4(color, 1.0);
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
  }


  // Generic gl flags and settings
  // @TODO Might not want this.
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
			u_texture: texture.bind(0),
      ray00: tracer.getRayForPixel(0, h),
      ray10: tracer.getRayForPixel(w, h),
      ray01: tracer.getRayForPixel(0, 0),
      ray11: tracer.getRayForPixel(w, 0),
    });

    // Trace the rays
    voxelShader.draw(planeMesh);

    // Bounding box overlay
		flatShader.uniforms({
			u_color: [1,1,1,1],
			u_mvp: mvp
		}).draw(cubeMesh, gl.LINES, "wireframe" );

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
