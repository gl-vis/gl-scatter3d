attribute vec3 position;
attribute vec3 color;
attribute vec2 glyph;
attribute vec4 id;

uniform mat4 model, view, projection;

varying vec3 interpColor;
varying vec4 pickId;
varying vec3 worldCoordinate;

void main() {
  vec4 worldPosition = model * vec4(position, 1);
  vec4 viewPosition = view * worldPosition;
  viewPosition = viewPosition / viewPosition.w;
  vec4 clipPosition = projection * (viewPosition + vec4(glyph.x, -glyph.y, 0, 0));
  gl_Position = clipPosition;
  interpColor = color;
  pickId = id;
  //worldCoordinate = worldPosition.xyz / worldPosition.w;
  worldCoordinate = position;
}