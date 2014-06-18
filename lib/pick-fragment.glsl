precision highp float;

varying vec4 pickId;

void main() {
  gl_FragColor = pickId;
}