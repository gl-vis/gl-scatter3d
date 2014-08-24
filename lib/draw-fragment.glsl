precision mediump float;

uniform vec4 highlightId;
uniform vec3 highlightColor;
uniform vec3 clipBounds[2];

varying vec3 interpColor;
varying vec4 pickId;
varying vec3 worldCoordinate;

void main() {
  if(any(lessThan(worldCoordinate, clipBounds[0])) || any(greaterThan(worldCoordinate, clipBounds[1]))) {
    discard;
  }
  if(distance(pickId, highlightId) < 0.001) {
    gl_FragColor = vec4(highlightColor,1);
  } else {
    gl_FragColor = vec4(interpColor,1);
  }
}