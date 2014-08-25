precision mediump float;

uniform vec4 highlightId;
uniform vec4 highlightColor;
uniform vec3 clipBounds[2];

varying vec4 interpColor;
varying vec4 pickId;
varying vec3 worldCoordinate;

void main() {
  if(any(lessThan(worldCoordinate, clipBounds[0])) || any(greaterThan(worldCoordinate, clipBounds[1]))) {
    discard;
  }
  if(distance(pickId, highlightId) < 0.001) {
    gl_FragColor = highlightColor;
  } else {
    gl_FragColor = interpColor;
  }
}