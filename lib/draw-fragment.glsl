precision highp float;

#pragma glslify: outOfRange = require(glsl-out-of-range)

uniform vec3 fragClipBounds[2];
uniform float opacity;

varying vec4 interpColor;
varying vec3 dataCoordinate;

void main() {
  float alpha = interpColor.a * opacity;
  if (
    outOfRange(fragClipBounds[0], fragClipBounds[1], dataCoordinate) ||
    alpha == 0.
  ) discard;
  gl_FragColor = vec4(interpColor.rgb, alpha);
}
