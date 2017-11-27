// compute the near and far intersections of the cube (stored in the x and y components) using the slab method
// no intersection means vec.x > vec.y (really tNear > tFar)
var intersectCubeSource =`
vec2 intersectCube(vec3 origin, vec3 ray, vec3 cubeMin, vec3 cubeMax) {
  vec3 tMin = (cubeMin - origin) / ray;
  vec3 tMax = (cubeMax - origin) / ray;
  vec3 t1 = min(tMin, tMax);
  vec3 t2 = max(tMin, tMax);
  float tNear = max(max(t1.x, t1.y), t1.z);
  float tFar = min(min(t2.x, t2.y), t2.z);
  return vec2(tNear, tFar);
}
`;
var angleX = 30;
var angleY = 10;
var gl = GL.create();
var mesh = GL.Mesh.plane();
var shader = new GL.Shader(`
  uniform vec3 ray00;
  uniform vec3 ray10;
  uniform vec3 ray01;
  uniform vec3 ray11;
  varying vec3 initialRay;

  void main() {
    vec2 t = gl_Vertex.xy * 0.5 + 0.5;
    initialRay = mix(mix(ray00, ray10, t.x), mix(ray01, ray11, t.x), t.y);
    gl_Position = gl_Vertex;
  }
`, `
  vec3 roomCubeMin = vec3(-1.0, -1.0, -1.0);
  vec3 roomCubeMax = vec3(1.0, 1.0, 1.0);
  const float INFINITY = 1.0e9;
  uniform vec3 eye;
  varying vec3 initialRay;
  ${intersectCubeSource}
  void main() {
    vec3 origin = eye, ray = initialRay, color = vec3(0.0), mask = vec3(1.0);
    vec2 tRoom = intersectCube(origin, ray, roomCubeMin, roomCubeMax);

    for (int bounce = 0; bounce < 2; bounce++) {
      /* Find the closest intersection with the scene */
      float planeT = -origin.y / ray.y;
      vec3 hit = origin + ray * planeT;
      if (planeT < 0.0 || abs(hit.x) > 40.0 || abs(hit.z) > 40.0) planeT = INFINITY;
      float t = planeT;
      if(tRoom.x < tRoom.y) t = tRoom.y;

      /* The background is white */
      if (t == INFINITY) {
        color += mask;
        break;
      }

      /* Calculate the intersection */
      hit = origin + ray * t;
      if (t == planeT) {
        /* Look up the checkerboard color */
        vec3 c = fract(hit * 0.5) - 0.5;
        float checkerboard = c.x * c.z > 0.0 ? 1.0 : 0.0;
        color += vec3(0.7, 0.7, 0.7) * mask;
        break;
      }
    }

    gl_FragColor = vec4(color, 1.0);
  }
`);

gl.onmousemove = function(e) {
  if (e.dragging) {
    angleY += e.deltaX;
    angleX += e.deltaY;
    angleX = Math.max(-90, Math.min(90, angleX));
    gl.ondraw();
  }
};

gl.ondraw = function() {
  // Camera setup
  gl.loadIdentity();
  gl.translate(0, 0, -10);
  gl.rotate(angleX, 1, 0, 0);
  gl.rotate(angleY, 0, 1, 0);

  // Get corner rays
  var w = gl.canvas.width;
  var h = gl.canvas.height;
  var tracer = new GL.Raytracer();
  shader.uniforms({
    eye: tracer.eye,
    ray00: tracer.getRayForPixel(0, h),
    ray10: tracer.getRayForPixel(w, h),
    ray01: tracer.getRayForPixel(0, 0),
    ray11: tracer.getRayForPixel(w, 0)
  });

  // Trace the rays
  shader.draw(mesh);

  // Draw debug output to show that the raytraced scene lines up correctly with
  // the rasterized scene
  gl.color(0, 0, 0, 0.5);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.begin(gl.LINES);
  for (var s = 4, i = -s; i <= s; i++) {
    gl.vertex(-s, 0, i);
    gl.vertex(s, 0, i);
    gl.vertex(i, 0, -s);
    gl.vertex(i, 0, s);
  }
  gl.end();
  gl.disable(gl.BLEND);
};

gl.fullscreen();
