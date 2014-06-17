var shell = require("gl-now")({tickRate: 2})
var camera = require("game-shell-orbit-camera")(shell)
var createPoints = require("../pointcloud")
var createAxes = require("gl-axes")
var mat4 = require("gl-matrix").mat4
 
var points, axes

camera.lookAt(
  [2,2,2],
  [0.5,0.5,0.5],
  [0,1,0])
 
shell.on("gl-init", function() {
  var gl = shell.gl

  var initialData = {
    positions: [ [1, 0, -1], [0, 1, -1], [0, 0, 1], [1,1,-1], [1,0,1], [0,1,1] ],
    glyphs: [  "▼", "★", "■", "◆", "✚", "✖" ],
    colors: [ [0,1,0], [0,0,1], [1,1,0], [1,0,1], [0,1,1], [0,0,0] ],
    size: 12,
    orthographic: true
  }

  for(var i=0; i<100; ++i) {
    var theta = i / 100.0 * 2.0 * Math.PI
    var x = Math.cos(theta)
    var y = Math.sin(theta)
    initialData.positions.push([ x, y, 0 ])
    initialData.glyphs.push("●")
    initialData.colors.push([1, 0, 0])
  }

  points = createPoints(gl, initialData)

  axes = createAxes(gl, {
    bounds: [[-1,-1, -1], [1,1,1]],
    tickSpacing: [.1, .1, .1]
  })
})
 
shell.on("gl-render", function() {
  var gl = shell.gl
  var cameraParams = {
    view: camera.view(),
    projection: mat4.perspective(
        mat4.create(),
        Math.PI/4.0,
        shell.width/shell.height,
        0.1,
        1000.0)
  }
  gl.enable(gl.DEPTH_TEST)
  points.draw(cameraParams)
  
  axes.draw(cameraParams)
})