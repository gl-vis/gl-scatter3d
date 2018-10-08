precision mediump float;

#pragma glslify: outOfRange = require(./reversed-scenes-out-of-range.glsl)

attribute vec3 position;
attribute vec4 color;
attribute vec2 glyph;
attribute vec4 id;

uniform mat4 model, view, projection;
uniform vec2 screenSize;
uniform vec3 clipBounds[2];
uniform float highlightScale, pixelRatio;
uniform vec4 highlightId;

varying vec4 interpColor;
varying vec4 pickId;
varying vec3 dataCoordinate;

void main() {
  if ((outOfRange(clipBounds[0].x, clipBounds[1].x, position.x)) ||
      (outOfRange(clipBounds[0].y, clipBounds[1].y, position.y)) ||
      (outOfRange(clipBounds[0].z, clipBounds[1].z, position.z))) {

    gl_Position = vec4(0,0,0,0);
  } else {
    float scale = pixelRatio;
    if(distance(highlightId.bgr, id.bgr) < 0.001) {
      scale *= highlightScale;
    }

    vec4 worldPosition = model * vec4(position, 1.0);
    vec4 viewPosition = view * worldPosition;
    vec4 clipPosition = projection * viewPosition;
    clipPosition /= clipPosition.w;

    gl_Position = clipPosition + vec4(screenSize * scale * vec2(glyph.x, -glyph.y), 0.0, 0.0);
    interpColor = color;
    pickId = id;
    dataCoordinate = position;
  }
}