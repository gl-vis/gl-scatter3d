precision mediump float;

uniform vec3 fragClipBounds[2];
uniform float opacity;

varying vec4 interpColor;
varying vec4 pickId;
varying vec3 dataCoordinate;

bool outOfRange(float a, float b, float p) {
  if (p > max(a, b)) return true;
  if (p < min(a, b)) return true;
  return false;
}

void main() {
  if (outOfRange(fragClipBounds[0].x, fragClipBounds[1].x, dataCoordinate.x)) discard;
  if (outOfRange(fragClipBounds[0].y, fragClipBounds[1].y, dataCoordinate.y)) discard;
  if (outOfRange(fragClipBounds[0].z, fragClipBounds[1].z, dataCoordinate.z)) discard;

  gl_FragColor = interpColor * opacity;
}
