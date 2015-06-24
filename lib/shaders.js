var createShaderWrapper = require('gl-shader')
var glslify = require('glslify')

var perspectiveVertSrc = glslify('./perspective.glsl')
var orthographicVertSrc = glslify('./orthographic.glsl')
var projectionVertSrc = glslify('./projection.glsl')
var drawFragSrc = glslify('./draw-fragment.glsl')
var pickFragSrc = glslify('./pick-fragment.glsl')

var perspective = {
    vertex: perspectiveVertSrc,
    fragment: drawFragSrc
  },
  ortho = {
    vertex: orthographicVertSrc,
    fragment: drawFragSrc
  },
  project = {
    vertex: projectionVertSrc,
    fragment: drawFragSrc
  },
  pickPerspective = {
    vertex: perspectiveVertSrc,
    fragment: pickFragSrc
  },
  pickOrtho = {
    vertex: orthographicVertSrc,
    fragment: pickFragSrc
  },
  pickProject = {
    vertex: projectionVertSrc,
    fragment: pickFragSrc
  }

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
