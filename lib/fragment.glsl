precision highp float;

varying vec3 interpColor;

void main() {
  gl_FragColor = vec4(interpColor,1);
}