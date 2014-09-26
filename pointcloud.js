'use strict'

var createBuffer  = require('gl-buffer')
var createVAO     = require('gl-vao')
var glslify       = require('glslify')
var pool          = require('typedarray-pool')
var getCubeParams = require('gl-axes/lib/cube')
var mat4          = require('gl-mat4')
var vec4          = require('gl-matrix').vec4
var vec3          = require('gl-matrix').vec3
var getGlyph      = require('./lib/glyphs')

var createShader = glslify({
    vertex:   './lib/perspective.glsl',
    fragment: './lib/draw-fragment.glsl'
  }),
  createOrthoShader = glslify({
    vertex:   './lib/orthographic.glsl',
    fragment: './lib/draw-fragment.glsl'
  }),
  createProjectShader = glslify({
    vertex:   './lib/projection.glsl',
    fragment: './lib/draw-fragment.glsl'
  }),
  createPickPerspectiveShader = glslify({
    vertex:   './lib/perspective.glsl',
    fragment: './lib/pick-fragment.glsl'
  }),
  createPickOrthoShader = glslify({
    vertex:   './lib/orthographic.glsl',
    fragment: './lib/pick-fragment.glsl'
  }),
  createPickProjectShader = glslify({
    vertex:   './lib/projection.glsl',
    fragment: './lib/pick-fragment.glsl'
  })

var IDENTITY = [1,0,0,0,
                0,1,0,0,
                0,0,1,0,
                0,0,0,1]

module.exports = createPointCloud

function project(p, v, m, x) {
  vec4.transformMat4(x, x, m)
  vec4.transformMat4(x, x, v)
  return vec4.transformMat4(x, x, p)
}

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
  projectShader,
  pointBuffer, 
  colorBuffer, 
  glyphBuffer,
  idBuffer,
  vao, 
  pickPerspectiveShader, 
  pickOrthoShader,
  pickProjectShader) {

  this.gl              = gl

  this.shader          = shader
  this.orthoShader     = orthoShader
  this.projectShader   = projectShader

  this.pointBuffer     = pointBuffer
  this.colorBuffer     = colorBuffer
  this.glyphBuffer     = glyphBuffer
  this.idBuffer        = idBuffer
  this.vao             = vao
  this.vertexCount     = 0
  this.lineVertexCount = 0

  this.lineWidth       = 0
  this.projectScale    = 2.0/3.0
  this.projectOpacity  = 1.0
  
  this.pickId                = 0
  this.pickPerspectiveShader = pickPerspectiveShader
  this.pickOrthoShader       = pickOrthoShader
  this.pickProjectShader     = pickProjectShader
  this.points                = []

  this.useOrtho = false
  this.bounds   = [[ Infinity,Infinity,Infinity],
                   [-Infinity,-Infinity,-Infinity]]

  //Axes projections
  this.axesProject = [ false, false, false ]
  this.axesBounds = [[-Infinity,-Infinity,-Infinity],
                     [ Infinity, Infinity, Infinity]]

  this.highlightColor = [0,0,0,1]
  this.highlightId    = [1,1,1,1]

  this.clipBounds = [[-Infinity,-Infinity,-Infinity], 
                     [ Infinity, Infinity, Infinity]]
}

var proto = PointCloud.prototype

function drawProject(shader, points, camera) {
  var axesProject = points.axesProject
  if(!(axesProject[0] || axesProject[1] || axesProject[2])) {
    return
  }

  var gl         = points.gl
  var uniforms   = shader.uniforms
  var model      = camera.model      || IDENTITY
  var view       = camera.view       || IDENTITY
  var projection = camera.projection || IDENTITY
  var bounds     = points.axesBounds
  var clipBounds = points.clipBounds.map(clampVec)
  var cubeParams = getCubeParams(model, view, projection, bounds)
  var cubeAxis   = cubeParams.axis

  shader.bind()
  uniforms.view           = view
  uniforms.projection     = projection
  uniforms.screenSize     = [2.0/gl.drawingBufferWidth, 2.0/gl.drawingBufferHeight]
  uniforms.highlightId    = points.highlightId
  uniforms.highlightColor = points.highlightColor
  uniforms.clipBounds     = clipBounds
  uniforms.scale          = points.projectScale
  uniforms.opacity        = points.projectOpacity

  for(var i=0; i<3; ++i) {
    if(!axesProject[i]) {
      continue
    }

    //Project model matrix
    var pmodel = IDENTITY.slice()
    pmodel[5*i] = 0
    if(cubeAxis[i] < 0) {
      pmodel[12+i] = bounds[0][i]
    } else {
      pmodel[12+i] = bounds[1][i]
    }
    mat4.multiply(pmodel, model, pmodel)
    uniforms.model = pmodel

    //Compute initial axes
    var u = (i+1)%3
    var v = (i+2)%3
    var du = [0,0,0]
    var dv = [0,0,0]
    du[u] = 1
    dv[v] = 1

    //Align orientation relative to viewer
    var mdu = project(projection, view, model, [du[0],du[1],du[2],0])
    var mdv = project(projection, view, model, [dv[0],dv[1],dv[2],0])
    if(Math.abs(mdu[1]) > Math.abs(mdv[1])) {
      var tmp = mdu
      mdu = mdv
      mdv = tmp
      tmp = du
      du = dv
      dv = tmp
      var t = u
      u = v
      v = t
    }
    if(mdu[0] < 0) {
      du[u] = -1
    }
    if(mdv[1] > 0) {
      dv[v] = -1
    }
    uniforms.axes = [du, dv]

    //Update fragment clip bounds
    var fragClip = [clipBounds[0].slice(), clipBounds[1].slice()]
    fragClip[0][i] = -1e8
    fragClip[1][i] = 1e8
    uniforms.fragClipBounds = fragClip

    //Draw interior
    points.vao.draw(gl.TRIANGLES, points.vertexCount)

    //Draw edges
    if(points.lineWidth > 0) {
      gl.lineWidth(points.lineWidth)
      points.vao.draw(gl.LINES, points.lineVertexCount, points.vertexCount)
    }
  }
}


function drawFull(shader, pshader, points, camera) {
  var gl = points.gl
  gl.depthFunc(gl.LEQUAL)

  shader.bind()
  shader.uniforms = {
    model:          camera.model      || IDENTITY,
    view:           camera.view       || IDENTITY,
    projection:     camera.projection || IDENTITY,
    screenSize:     [2.0/gl.drawingBufferWidth, 2.0/gl.drawingBufferHeight],
    highlightId:    points.highlightId,
    highlightColor: points.highlightColor,
    clipBounds:     points.clipBounds.map(clampVec),
    fragClipBounds: [[-1e8,-1e8,-1e8],[1e8,1e8,1e8]],
    opacity:        1
  }

  points.vao.bind()

  //Draw interior
  points.vao.draw(gl.TRIANGLES, points.vertexCount)

  //Draw edges
  if(points.lineWidth > 0) {
    gl.lineWidth(points.lineWidth)
    points.vao.draw(gl.LINES, points.lineVertexCount, points.vertexCount)
  }

  drawProject(pshader, points, camera)

  points.vao.unbind()
}

proto.draw = function(camera) {
  var shader = this.useOrtho ? this.orthoShader : this.shader
  drawFull(shader, this.projectShader, this, camera)
}

proto.drawPick = function(camera) {
  var shader = this.useOrtho ? this.pickOrthoShader : this.pickPerspectiveShader
  drawFull(shader, this.pickProjectShader, this, camera)
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
  if('project' in options) {
    if(Array.isArray(options.project)) {
      var v = !!options.project
      this.axesProject = [v,v,v]
    } else {
      this.axesProject = options.project
    }
  }
  if('axisBounds' in options) {
    this.axesBounds = options.axisBounds
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
  var orthoShader = createOrthoShader(gl)
  var projectShader = createProjectShader(gl)
  var pickPerspectiveShader = createPickPerspectiveShader(gl)
  var pickOrthoShader = createPickOrthoShader(gl)
  var pickProjectShader = createPickProjectShader(gl)

  var shaders = [shader, 
                 orthoShader, 
                 projectShader, 
                 pickPerspectiveShader, 
                 pickOrthoShader,
                 pickProjectShader]

  for(var i=0; i<shaders.length; ++i) {
    var attr = shaders[i].attributes
    attr.position.location = 0
    attr.color.location = 1
    attr.glyph.location = 2
    attr.id.location = 3
  }

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
    projectShader,
    pointBuffer, 
    colorBuffer, 
    glyphBuffer, 
    idBuffer, 
    vao, 
    pickPerspectiveShader,
    pickOrthoShader,
    pickProjectShader)

  pointCloud.update(options)

  return pointCloud
}