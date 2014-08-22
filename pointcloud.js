"use strict"

var createBuffer = require("gl-buffer")
var createVAO = require("gl-vao")
var getGlyph = require("./lib/glyphs")
var glslify = require("glslify")

var createShader = glslify({
    vertex: "./lib/perspective.glsl",
    fragment: "./lib/draw-fragment.glsl"
  }),
  createOrthoShader = glslify({
    vertex: "./lib/orthographic.glsl",
    fragment: "./lib/draw-fragment.glsl"
  }),
  createPickPerspectiveShader = glslify({
    vertex: "./lib/perspective.glsl",
    fragment: "./lib/pick-fragment.glsl"
  }),
  createPickOrthoShader = glslify({
    vertex: "./lib/orthographic.glsl",
    fragment: "./lib/pick-fragment.glsl"
  })

module.exports = createPointCloud

function clampVec(v) {
  var result = new Array(3)
  for(var i=0; i<3; ++i) {
    result[i] = Math.min(Math.max(v[i], -1e8), 1e8)
  }
  return result
}

function ScatterPlotPickResult(index, position) {
  this.index = index
  this.position = position
}

function PointCloud(
  gl, 
  shader, 
  orthoShader, 
  pointBuffer, 
  colorBuffer, 
  glyphBuffer,
  idBuffer,
  vao, 
  pickPerspectiveShader, 
  pickOrthoShader) {

  this.gl = gl
  this.shader = shader
  this.orthoShader = orthoShader
  this.pointBuffer = pointBuffer
  this.colorBuffer = colorBuffer
  this.glyphBuffer = glyphBuffer
  this.idBuffer = idBuffer
  this.vao = vao
  this.vertexCount = 0
  
  this.pickId = 0
  this.pickPerspectiveShader = pickPerspectiveShader
  this.pickOrthoShader = pickOrthoShader
  this.points = []

  this.useOrtho = false
  this.bounds = [[0,0,0],[0,0,0]]

  this.highlightColor = [0,0,0]
  this.highlightId = [1,1,1,1]

  this.clipBounds = [[-Infinity,-Infinity,-Infinity], [Infinity,Infinity,Infinity]]
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
    screenSize: [2.0/gl.drawingBufferWidth, 2.0/gl.drawingBufferHeight],
    highlightId: this.highlightId,
    highlightColor: this.highlightColor,
    clipBounds: this.clipBounds.map(clampVec)
  }
  this.vao.bind()
  this.vao.draw(gl.TRIANGLES, this.vertexCount)
  this.vao.unbind()
}

proto.drawPick = function(camera) {
  var gl = this.gl
  var shader = this.useOrtho ? this.pickOrthoShader : this.pickPerspectiveShader
  shader.bind()
  shader.uniforms = {
    model: camera.model || [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1 ], 
    view: camera.view || [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1 ],
    projection: camera.projection || [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1 ],
    screenSize: [2.0/gl.drawingBufferWidth, 2.0/gl.drawingBufferHeight],
    clipBounds: this.clipBounds.map(clampVec),
    pickId: this.pickId
  }
  this.vao.bind()
  this.vao.draw(gl.TRIANGLES, this.vertexCount)
  this.vao.unbind()
}

proto.pick = function(selected) {
  if(!selected) {
    return null
  }
  if(selected.id !== this.pickId) {
    return null
  }
  var x = selected.value[2] + (selected.value[1]<<8) + (selected.value[0]<<16)
  if(x >= this.pointCount || x < 0) {
    return null
  }
  return new ScatterPlotPickResult(x, this.points[x].slice())
}

proto.highlight = function(pointId, color) {
  if(typeof pointId !== "number") {
    this.highlightId = [1,1,1,1]
    this.highlightColor = [0,0,0]
  } else {
    var a0 =  pointId     &0xff
    var a1 = (pointId>>8) &0xff
    var a2 = (pointId>>16)&0xff
    this.highlightId = [a0/255.0, a1/255.0, a2/255.0, this.pickId/255.0]
    if(color) {
      this.highlightColor = color
    } else {
      this.highlightColor = [0,0,0]
    }
  }
}

proto.update = function(options) {
  //Create new buffers
  var points = options.position
  if(!points) {
    throw new Error("Must specify points")
  }
  if("orthographic" in options) {
    this.useOrtho = !!options.orthographic
  }
  if("pickId" in options) {
    this.pickId = options.pickId>>>0
  }
  if("clipBounds" in options) {
    this.clipBounds = options.clipBounds
  }

  //Drawing geometry
  var pointArray = []
  var colorArray = []
  var glyphArray = []
  var pointData  = []
  var idArray = []

  //Bounds
  var lowerBound = [ Infinity, Infinity, Infinity]
  var upperBound = [-Infinity,-Infinity,-Infinity]

  //Picking geometry
  var pickCounter = (this.pickId << 24)

  //Unpack options
  var glyphs = options.glyph
  var colors = options.color
  var sizes = options.size
  
  for(var i=0; i<points.length; ++i) {
    var glyphMesh
    if(Array.isArray(glyphs)) {
      glyphMesh = getGlyph(glyphs[i])
    } else if(glyphs) {
      glyphMesh = getGlyph(glyphs)
    } else {
      glyphMesh = getGlyph("●")
    }

    var color
    if(Array.isArray(colors)) {
      if(Array.isArray(colors[0])) {
        color = colors[i]
      } else {
        color = colors
      }
    } else {
      color = [0,0,0]
    }

    var size
    if(Array.isArray(sizes)) {
      size = sizes[i]
    } else if(sizes) {
      size = sizes
    } else {
      size = 0.1
    }

    var x = points[i]
    for(var j=0; j<3; ++j) {
      upperBound[j] = Math.max(upperBound[j], x[j])
      lowerBound[j] = Math.min(lowerBound[j], x[j]) 
    }

    pointData.push(x.slice())

    var cells = glyphMesh.cells
    var positions = glyphMesh.positions

    //Compute pick index for point
    for(var j=0; j<cells.length; ++j) {
      var c = cells[j]
      for(var k=0; k<3; ++k) {
        pointArray.push.apply(pointArray, x)
        colorArray.push.apply(colorArray, color)
        idArray.push(pickCounter)
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

    //Increment pickCounter
    pickCounter += 1
  }

  //Update vertex counts
  this.vertexCount = (pointArray.length / 3)|0
  
  //Update buffers
  this.pointBuffer.update(pointArray)
  this.colorBuffer.update(colorArray)
  this.glyphBuffer.update(glyphArray)
  this.idBuffer.update(new Uint32Array(idArray))

  //Update bounds
  this.bounds = [lowerBound, upperBound]

  //Save points
  this.points = pointData

  //Save number of points
  this.pointCount = points.length
}

proto.dispose = function() {
  //Shaders
  this.shader.dispose()
  this.orthoShader.dispose()
  this.pickPerspectiveShader.dispose()
  this.pickOrthoShader.dispose()

  //Vertex array
  this.vao.dispose()

  //Buffers
  this.pointBuffer.dispose()
  this.colorBuffer.dispose()
  this.glyphBuffer.dispose()
  this.idBuffer.dispose()
}

function createPointCloud(gl, options) {
  options = options || {}

  var shader = createShader(gl)
  shader.attributes.position.location = 0
  shader.attributes.color.location = 1
  shader.attributes.glyph.location = 2
  shader.attributes.id.location = 3

  var orthoShader = createOrthoShader(gl)
  orthoShader.attributes.position.location = 0
  orthoShader.attributes.color.location = 1
  orthoShader.attributes.glyph.location = 2
  orthoShader.attributes.id.location = 3

  var pickPerspectiveShader = createPickPerspectiveShader(gl)
  pickPerspectiveShader.attributes.position.location = 0
  pickPerspectiveShader.attributes.glyph.location = 2
  pickPerspectiveShader.attributes.id.location = 3

  var pickOrthoShader = createPickOrthoShader(gl)
  pickOrthoShader.attributes.position.location = 0
  pickOrthoShader.attributes.glyph.location = 2
  pickOrthoShader.attributes.id.location = 3
  
  var pointBuffer = createBuffer(gl)
  var colorBuffer = createBuffer(gl)
  var glyphBuffer = createBuffer(gl)
  var idBuffer    = createBuffer(gl)
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
    },
    {
      buffer: idBuffer,
      size: 4,
      type: gl.UNSIGNED_BYTE,
      normalized: true
    }
  ])

  var pointCloud = new PointCloud(
    gl, 
    shader, 
    orthoShader, 
    pointBuffer, 
    colorBuffer, 
    glyphBuffer, 
    idBuffer, 
    vao, 
    pickPerspectiveShader,
    pickOrthoShader)

  pointCloud.update(options)

  return pointCloud
}