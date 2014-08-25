precision mediump float;

uniform vec3 clipBounds[2];

varying vec4 pickId;
varying vec3 worldCoordinate;

void main() {
  gl_FragColor = pickId.abgr;
}