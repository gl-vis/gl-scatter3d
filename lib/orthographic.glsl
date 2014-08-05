precision mediump float;

attribute vec3 position;
attribute vec3 color;
attribute vec2 glyph;
attribute vec4 id;

uniform mat4 model, view, projection;
uniform vec2 screenSize;

varying vec3 interpColor;
varying vec4 pickId;
varying vec3 worldCoordinate;

void main() {
  vec4 worldPosition = model * vec4(position, 1.0);
  vec4 viewPosition = view * worldPosition;
  vec4 clipPosition = projection * viewPosition;
  clipPosition /= clipPosition.w;
  gl_Position = clipPosition + vec4(screenSize * vec2(glyph.x, -glyph.y), 0.0, 0.0);
  interpColor = color;
  pickId = id;
  //worldCoordinate = worldPosition.xyz / worldPosition.w;
  worldCoordinate = position;
}