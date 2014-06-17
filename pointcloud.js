"use strict"

var createBuffer = require("gl-buffer")
var createVAO = require("gl-vao")
var getGlyph = require("./lib/glyphs")
var glslify = require("glslify")

var createShader = glslify({
  vertex: "./lib/vertex.glsl",
  fragment: "./lib/fragment.glsl"
})

var createOrthoShader = glslify({
  vertex: "./lib/orthographic.glsl",
  fragment: "./lib/fragment.glsl"
})

module.exports = createPointCloud

function PointCloud(gl, shader, orthoShader, pointBuffer, colorBuffer, glyphBuffer, vao, vertexCount) {
  this.gl = gl
  this.shader = shader
  this.orthoShader = orthoShader
  this.pointBuffer = pointBuffer
  this.colorBuffer = colorBuffer
  this.glyphBuffer = glyphBuffer
  this.vao = vao
  this.vertexCount = vertexCount
  this.useOrtho = false
}

var proto = PointCloud.prototype

proto.draw = function(camera) {
  var gl = this.gl
  var shader = this.useOrtho ? this.orthoShader : this.shader
  shader.bind()
  shader.uniforms = {
    model: camera.model || [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1 ], 
    view: camera.view || [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1 ],
    projection: camera.projection || [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1 ],
    screenSize: [2.0/gl.drawingBufferWidth, 2.0/gl.drawingBufferHeight]
  }
  this.vao.bind()
  this.vao.draw(gl.TRIANGLES, this.vertexCount)
  this.vao.unbind()
}

proto.update = function(options) {
  //Create new buffers
  var points = options.positions
  if(!points) {
    throw new Error("Must specify points")
  }

  if("orthographic" in options) {
    this.useOrtho = !!options.orthographic
  }

  //Build geometry
  var pointArray = []
  var colorArray = []
  var glyphArray = []
  for(var i=0; i<points.length; ++i) {
    var glyphMesh
    if(options.glyphs) {
      glyphMesh = getGlyph(options.glyphs[i])
    } else if(options.glyph) {
      glyphMesh = getGlyph(options.glyph)
    } else {
      glyphMesh = getGlyph("●")
    }

    var color
    if(options.colors) {
      color = options.colors[i]
    } else if(options.color) {
      color = options.color
    } else {
      color = [0,0,0]
    }

    var size
    if(options.sizes) {
      size = options.sizes[i]
    } else if(options.size) {
      size = options.size
    } else {
      size = 1.0
    }

    var x = points[i]
    var cells = glyphMesh.cells
    var positions = glyphMesh.positions

    for(var j=0; j<cells.length; ++j) {
      var c = cells[j]
      for(var k=0; k<3; ++k) {
        pointArray.push.apply(pointArray, x)
        colorArray.push.apply(colorArray, color)
        if(size === 1.0) {
          glyphArray.push.apply(glyphArray, positions[c[k]])
        } else {
          var gp = positions[c[k]]
          for(var l=0; l<2; ++l) {
            glyphArray.push(size * gp[l])
          }
        }
      }
    }
  }

  this.vertexCount = (pointArray.length / 3)|0

  //Update buffers
  this.pointBuffer.update(pointArray)
  this.colorBuffer.update(colorArray)
  this.glyphBuffer.update(glyphArray)
}

proto.dispose = function() {
  this.shader.dispose()
  this.pointBuffer.dispose()
  this.glyphBuffer.dispose()
  this.vao.dispose()
}

function createPointCloud(gl, options) {
  options = options || {}

  var shader = createShader(gl)
  shader.attributes.position.location = 0
  shader.attributes.color.location = 1
  shader.attributes.glyph.location = 2

  var orthoShader = createOrthoShader(gl)
  orthoShader.attributes.position.location = 0
  orthoShader.attributes.color.location = 1
  orthoShader.attributes.glyph.location = 2

  var pointBuffer = createBuffer(gl)
  var colorBuffer = createBuffer(gl)
  var glyphBuffer = createBuffer(gl)
  var vao = createVAO(gl, [
    {
      buffer: pointBuffer,
      size: 3,
      type: gl.FLOAT
    },
    {
      buffer: colorBuffer,
      size: 3,
      type: gl.FLOAT
    },
    {
      buffer: glyphBuffer,
      size: 2,
      type: gl.FLOAT
    }
  ])

  var pointCloud = new PointCloud(gl, shader, orthoShader, pointBuffer, colorBuffer, glyphBuffer, vao, 0)
  pointCloud.update(options)
  return pointCloud
}