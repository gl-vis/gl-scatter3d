precision highp float;

uniform vec4 highlightId;
uniform vec3 highlightColor;

varying vec3 interpColor;
varying vec4 pickId;

void main() {
  if(distance(pickId, highlightId) < 0.001) {
    gl_FragColor = vec4(highlightColor,1);
  } else {
    gl_FragColor = vec4(interpColor,1);
  }
}