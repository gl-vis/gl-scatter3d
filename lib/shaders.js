var createShaderWrapper = require('gl-shader')
var glslify = require('glslify')

var perspective = glslify({
    vertex:   './perspective.glsl',
    fragment: './draw-fragment.glsl',
    sourceOnly: true
  }),
  ortho =  glslify({
    vertex:   './orthographic.glsl',
    fragment: './draw-fragment.glsl',
    sourceOnly: true
  }),
  project = glslify({
    vertex:   './projection.glsl',
    fragment: './draw-fragment.glsl',
    sourceOnly: true
  }),
  pickPerspective = glslify({
    vertex:   './perspective.glsl',
    fragment: './pick-fragment.glsl',
    sourceOnly: true
  }),
  pickOrtho = glslify({
    vertex:   './orthographic.glsl',
    fragment: './pick-fragment.glsl',
    sourceOnly: true
  }),
  pickProject = glslify({
    vertex:   './projection.glsl',
    fragment: './pick-fragment.glsl',
    sourceOnly: true
  })

function createShader(gl, src) {
  var shader = createShaderWrapper(gl, src)
  var attr = shader.attributes
  attr.position.location = 0
  attr.color.location = 1
  attr.glyph.location = 2
  attr.id.location = 3
  return shader
}

exports.createPerspective = function(gl) {
  return createShader(gl, perspective)
}
exports.createOrtho = function(gl) {
  return createShader(gl, ortho)
}
exports.createProject = function(gl) {
  return createShader(gl, project)
}
exports.createPickPerspective = function(gl) {
  return createShader(gl, pickPerspective)
}
exports.createPickOrtho = function(gl) {
  return createShader(gl, pickOrtho)
}
exports.createPickProject = function(gl) {
  return createShader(gl, pickProject)
}