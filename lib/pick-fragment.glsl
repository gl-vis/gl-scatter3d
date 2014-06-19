precision highp float;

uniform vec3 clipBounds[2];

varying vec4 pickId;
varying vec3 worldCoordinate;

void main() {
  if(any(lessThan(worldCoordinate, clipBounds[0])) || any(greaterThan(worldCoordinate, clipBounds[1]))) {
      discard;
  }
  gl_FragColor = pickId;
}