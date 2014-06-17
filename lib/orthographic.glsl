attribute vec3 position;
attribute vec3 color;
attribute vec2 glyph;

uniform mat4 model, view, projection;
uniform vec2 screenSize;

varying vec3 interpColor;

void main() {
  vec4 clipPosition = projection * view * model * vec4(position, 1.0);
  clipPosition /= clipPosition.w;
  gl_Position = clipPosition + vec4(screenSize * glyph, 0, 0);
  interpColor = color;
}