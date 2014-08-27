'use strict'

var createBuffer  = require('gl-buffer')
var createVAO     = require('gl-vao')
var glslify       = require('glslify')
var pool          = require('typedarray-pool')
var getGlyph      = require('./lib/glyphs')

var createShader = glslify({
    vertex:   './lib/perspective.glsl',
    fragment: './lib/draw-fragment.glsl'
  }),
  createOrthoShader = glslify({
    vertex:   './lib/orthographic.glsl',
    fragment: './lib/draw-fragment.glsl'
  }),
  createPickPerspectiveShader = glslify({
    vertex:   './lib/perspective.glsl',
    fragment: './lib/pick-fragment.glsl'
  }),
  createPickOrthoShader = glslify({
    vertex:   './lib/orthographic.glsl',
    fragment: './lib/pick-fragment.glsl'
  })

var IDENTITY = [1,0,0,0,
                0,1,0,0,
                0,0,1,0,
                0,0,0,1]

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

  this.gl              = gl
  this.shader          = shader
  this.orthoShader     = orthoShader
  this.pointBuffer     = pointBuffer
  this.colorBuffer     = colorBuffer
  this.glyphBuffer     = glyphBuffer
  this.idBuffer        = idBuffer
  this.vao             = vao
  this.vertexCount     = 0
  this.lineVertexCount = 0

  this.lineWidth       = 0
  
  this.pickId                = 0
  this.pickPerspectiveShader = pickPerspectiveShader
  this.pickOrthoShader       = pickOrthoShader
  this.points                = []

  this.useOrtho = false
  this.bounds   = [[0,0,0],
                   [0,0,0]]

  this.highlightColor = [0,0,0,1]
  this.highlightId    = [1,1,1,1]

  this.clipBounds = [[-Infinity,-Infinity,-Infinity], 
                     [ Infinity, Infinity, Infinity]]
}

var proto = PointCloud.prototype

proto.draw = function(camera) {
  var gl     = this.gl
  var shader = this.useOrtho ? this.orthoShader : this.shader

  gl.depthFunc(gl.LEQUAL)

  shader.bind()
  shader.uniforms = {
    model:          camera.model      || IDENTITY,
    view:           camera.view       || IDENTITY,
    projection:     camera.projection || IDENTITY,
    screenSize:     [2.0/gl.drawingBufferWidth, 2.0/gl.drawingBufferHeight],
    highlightId:    this.highlightId,
    highlightColor: this.highlightColor,
    clipBounds:     this.clipBounds.map(clampVec)
  }

  this.vao.bind()

  //Draw interior
  this.vao.draw(gl.TRIANGLES, this.vertexCount)

  if(this.lineWidth > 0) {
    gl.lineWidth(this.lineWidth)
    this.vao.draw(gl.LINES, this.lineVertexCount, this.vertexCount)
  }

  this.vao.unbind()
}

proto.drawPick = function(camera) {
  var gl = this.gl
  var shader = this.useOrtho ? this.pickOrthoShader : this.pickPerspectiveShader
  shader.bind()
  shader.uniforms = {
    model:        camera.model      || IDENTITY, 
    view:         camera.view       || IDENTITY,
    projection:   camera.projection || IDENTITY,
    screenSize:   [2.0/gl.drawingBufferWidth, 2.0/gl.drawingBufferHeight],
    clipBounds:   this.clipBounds.map(clampVec),
    pickId:       this.pickId
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
    this.highlightColor = [0,0,0,1]
  } else {
    var a0 =  pointId     &0xff
    var a1 = (pointId>>8) &0xff
    var a2 = (pointId>>16)&0xff
    this.highlightId = [a0/255.0, a1/255.0, a2/255.0, this.pickId/255.0]
    if(color) {
      if(color.length === 3) {
        this.highlightColor = [color[0], color[1], color[2], 1]
      } else {
        this.highlightColor = color
      }
    } else {
      this.highlightColor = [0,0,0,1]
    }
  }
}

proto.update = function(options) {
  //Create new buffers
  var points = options.position
  if(!points) {
    throw new Error('gl-scatter-plot: Must specify points')
  }
  if('orthographic' in options) {
    this.useOrtho = !!options.orthographic
  }
  if('pickId' in options) {
    this.pickId = options.pickId>>>0
  }
  if('clipBounds' in options) {
    this.clipBounds = options.clipBounds
  }
  if('lineWidth' in options) {
    this.lineWidth = options.lineWidth
  }

  //Text font
  var font      = options.font      || 'normal'
  var alignment = options.alignment || [0,0]

  //Bounds
  var lowerBound = [ Infinity, Infinity, Infinity]
  var upperBound = [-Infinity,-Infinity,-Infinity]
  
  //Unpack options
  var glyphs     = options.glyph
  var colors     = options.color
  var sizes      = options.size
  var angles     = options.angle
  var lineColors = options.lineColor

  //Picking geometry
  var pickCounter = (this.pickId << 24)

  //First do pass to compute buffer sizes
  var triVertexCount     = 0
  var lineVertexCount = 0

  //Count number of points and buffer size
  var numPoints   = points.length

count_loop:
  for(var i=0; i<numPoints; ++i) {
    var x = points[i]
    for(var j=0; j<3; ++j) {
      if(isNaN(x[j]) || !isFinite(x[j])) {
        continue count_loop
      }
    }

    var glyphData
    if(Array.isArray(glyphs)) {
      glyphData = getGlyph(glyphs[i], font)
    } else if(glyphs) {
      glyphData = getGlyph(glyphs, font)
    } else {
      glyphData = getGlyph('●', font)
    }
    var glyphMesh   = glyphData[0]
    var glyphLines  = glyphData[1]
    var glyphBounds = glyphData[2]

    triVertexCount  += glyphMesh.cells.length * 3
    lineVertexCount += glyphLines.edges.length * 2
  }


  //Preallocate data
  var vertexCount   = triVertexCount + lineVertexCount
  var positionArray = pool.mallocFloat(3*vertexCount)
  var colorArray    = pool.mallocFloat(4*vertexCount)
  var glyphArray    = pool.mallocFloat(2*vertexCount)
  var idArray       = pool.mallocUint32(vertexCount)

  var textOffset = [0,alignment[1]]

  var triOffset  = 0
  var lineOffset = triVertexCount
  var color      = [0,0,0,1]
  var lineColor  = [0,0,0,1]

  var isColorArray      = Array.isArray(colors)     && Array.isArray(colors[0])
  var isLineColorArray  = Array.isArray(lineColors) && Array.isArray(lineColors[0])

fill_loop:
  for(var i=0; i<numPoints; ++i) {
    var x = points[i]
    for(var j=0; j<3; ++j) {
      if(isNaN(x[j]) || !isFinite(x[j])) {
        pickCounter += 1
        continue fill_loop
      }

      upperBound[j] = Math.max(upperBound[j], x[j])
      lowerBound[j] = Math.min(lowerBound[j], x[j]) 
    }

    var glyphData
    if(Array.isArray(glyphs)) {
      glyphData = getGlyph(glyphs[i], font)
    } else if(glyphs) {
      glyphData = getGlyph(glyphs, font)
    } else {
      glyphData = getGlyph('●', font)
    }
    var glyphMesh   = glyphData[0]
    var glyphLines  = glyphData[1]
    var glyphBounds = glyphData[2]


    //Get color
    if(Array.isArray(colors)) {
      var c
      if(isColorArray) {
        c = colors[i]
      } else {
        c = colors
      }
      if(c.length === 3) {
        for(var j=0; j<3; ++j) {
          color[j] = c[j]
        }
        color[3] = 1
      } else if(c.length === 4) {
        for(var j=0; j<4; ++j) {
          color[j] = c[j]
        }
      }
    } else {
      color[0] = color[1] = color[2] = 0
      color[3] = 1
    }

    //Get lineColor
    if(Array.isArray(lineColors)) {
      var c
      if(isLineColorArray) {
        c = lineColors[i]
      } else {
        c = lineColors
      }
      if(c.length === 3) {
        for(var j=0; j<3; ++j) {
          lineColor[j] = c[j]
        }
        lineColor[j] = 1
      } else if(c.length === 4) {
        for(var j=0; j<4; ++j) {
          lineColor[j] = c[j]
        }
      }
    } else {
      lineColor[0] = lineColor[1] = lineColor[2] = 0
      lineColor[3] = 1
    }

    var size = 0.5
    if(Array.isArray(sizes)) {
      size = +sizes[i]
    } else if(sizes) {
      size = +sizes
    } else if(this.useOrtho) {
      size = 12
    }

    var angle = 0
    if(Array.isArray(angles)) {
      angle = +angles[i]
    } else if(angles) {
      angle = +angles
    }

    //Loop through markers and append to buffers
    var cos = Math.cos(angle)
    var sin = Math.sin(angle)

    var x = points[i]
    for(var j=0; j<3; ++j) {
      upperBound[j] = Math.max(upperBound[j], x[j])
      lowerBound[j] = Math.min(lowerBound[j], x[j]) 
    }

    //Calculate text offset
    if(alignment[0] < 0) {
      textOffset[0] = alignment[0]  * (1+glyphBounds[1][0])
    } else if(alignment[0] > 0) {
      textOffset[0] = -alignment[0] * (1+glyphBounds[0][0])
    }

    //Write out inner marker
    var cells = glyphMesh.cells
    var verts = glyphMesh.positions

    for(var j=0; j<cells.length; ++j) {
      var cell = cells[j]
      for(var k=0; k<3; ++k) {
        for(var l=0; l<3; ++l) {
          positionArray[3*triOffset+l] = x[l]
        }
        for(var l=0; l<4; ++l) {
          colorArray[4*triOffset+l] = color[l]
        }
        idArray[triOffset] = pickCounter
        var p = verts[cell[k]]
        glyphArray[2*triOffset]   = size * (cos*p[0] - sin*p[1] + textOffset[0])
        glyphArray[2*triOffset+1] = size * (sin*p[0] + cos*p[1] + textOffset[1])
        triOffset += 1
      }
    }

    var cells = glyphLines.edges
    var verts = glyphLines.positions

    for(var j=0; j<cells.length; ++j) {
      var cell = cells[j]
      for(var k=0; k<2; ++k) {
        for(var l=0; l<3; ++l) {
          positionArray[3*lineOffset+l] = x[l]
        }
        for(var l=0; l<4; ++l) {
          colorArray[4*lineOffset+l] = lineColor[l]
        }
        idArray[lineOffset] = pickCounter
        var p = verts[cell[k]]
        glyphArray[2*lineOffset]   = size * (cos*p[0] - sin*p[1] + textOffset[0])
        glyphArray[2*lineOffset+1] = size * (sin*p[0] + cos*p[1] + textOffset[1])
        lineOffset += 1
      }
    }

    //Increment pickCounter
    pickCounter += 1
  }
  

  //Update vertex counts
  this.vertexCount      = triVertexCount
  this.lineVertexCount  = lineVertexCount
  
  //Update buffers
  this.pointBuffer.update(positionArray)
  this.colorBuffer.update(colorArray)
  this.glyphBuffer.update(glyphArray)
  this.idBuffer.update(new Uint32Array(idArray))

  pool.free(positionArray)
  pool.free(colorArray)
  pool.free(glyphArray)
  pool.free(idArray)

  //Update bounds
  for(var i=0; i<3; ++i) {
    if(lowerBounds[i] > upperBound[i]) {
      lowerBound[i] = -Infinity
      upperBound[i] =  Infinity
    }
  }
  this.bounds = [lowerBound, upperBound]

  //Save points
  this.points = points

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
      size: 4,
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