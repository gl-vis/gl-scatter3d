precision mediump float;

#pragma glslify: outOfRange = require(./reversed-scenes-out-of-range.glsl)

uniform vec3 fragClipBounds[2];
uniform float pickGroup;

varying vec4 pickId;
varying vec3 dataCoordinate;

void main() {
  if ((outOfRange(fragClipBounds[0].x, fragClipBounds[1].x, dataCoordinate.x)) ||
      (outOfRange(fragClipBounds[0].y, fragClipBounds[1].y, dataCoordinate.y)) ||
      (outOfRange(fragClipBounds[0].z, fragClipBounds[1].z, dataCoordinate.z))) discard;

  gl_FragColor = vec4(pickGroup, pickId.bgr);
}