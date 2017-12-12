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
        intersection = (origin + ray * t - vec3(pos)) * vec3(1 - axis) + (vec3(slab) + 0.5) * vec3(axis);
      }
      return vec4(intersection, t);
    }
    float intersectSlabs(vec3 origin, vec3 ray, ivec3 pos, ivec3 slab, ivec3 offset, out vec3 hit, out vec3 normal) {
      float hitT = INFINITY;
      vec4 intersection;
      ivec3 axis;
      axis = x_axis; intersection = intersectAxis(origin, ray, pos, slab, offset, axis);
      if (all(greaterThanEqual(intersection, vec4(0.0))) && all(lessThan(vec4(intersection), vec4(size, hitT)))) {
        hitT = intersection.w;
        hit = intersection.xyz;
        normal = vec3((offset * 2 - 1) * axis);
      }
      axis = y_axis; intersection = intersectAxis(origin, ray, pos, slab, offset, axis);
      if (all(greaterThanEqual(intersection, vec4(0.0))) && all(lessThan(vec4(intersection), vec4(size, hitT)))) {
        hitT = intersection.w;
        hit = intersection.xyz;
        normal = vec3((offset * 2 - 1) * axis);
      }
      axis = z_axis; intersection = intersectAxis(origin, ray, pos, slab, offset, axis);
      if (all(greaterThanEqual(intersection, vec4(0.0))) && all(lessThan(vec4(intersection), vec4(size, hitT)))) {
        hitT = intersection.w;
        hit = intersection.xyz;
        normal = vec3((offset * 2 - 1) * axis);
      }
      return hitT;
    }
    void main() {

      // // For testing ray directions
      // outColor = vec4(initialRay * 0.5 + 0.5, 1.0); return;

      vec3 origin = eye; // @TODO Does it get passed?
      vec3 ray = initialRay;
      vec3 color = vec3(0.0);
      ivec3 offset = 1 - ivec3(step(0.0, ray));
      ivec3 slab = ivec3(origin - vec3(pos)) - offset;
      slab = clamp(slab, izero, size - 1);
      // outColor = vec4(slab, 1.0); return;

      for (int i = 0; i < ITERATION_LIMIT; ++i) {
        // Break out of the loop if end is reached.
        if (all(lessThan(slab, izero)) && all(greaterThanEqual(slab, size))) {
            break;
        }

        vec3 hit, normal;
        float hitT = intersectSlabs(origin, ray, pos, slab, offset, hit, normal);

        if (hitT < INFINITY) {
          // outColor = vec4(normal, 1.0); return;
          // Look up texture
          vec4 voxelColor = texture( u_texture, hit / vec3(size));
          if (voxelColor.w > 0.5) {
            color = voxelColor.xyz * (max(dot(normal, toLight), 0.0) * 0.7 + 0.3);
            break;
          }
          slab = ivec3(hit) - offset;
        }
        else {
          break;
        }
      }
      outColor = vec4(color, 1.0);
    }
  `);

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
