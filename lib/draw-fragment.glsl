precision mediump float;

uniform vec4 highlightId;
uniform vec4 highlightColor;
uniform vec3 fragClipBounds[2];

varying vec4 interpColor;
varying vec4 pickId;
varying vec3 dataCoordinate;

void main() {
  if(any(lessThan(dataCoordinate, fragClipBounds[0]))   || 
     any(greaterThan(dataCoordinate, fragClipBounds[1])) ) {
    discard;
  } else if(distance(pickId, highlightId) < 0.001) {
    gl_FragColor = highlightColor;
  } else {
    gl_FragColor = interpColor;
  }
}