"use strict"

var shell = require("gl-now")
var camera = require("game-shell-orbit-camera")(shell)
var createPoints = require("gl-point-cloud")
var createAxes = require("gl-axes")
 
var points, axes

camera.lookAt(
  [0,0,0],
  [10,10,10],
  [0,1,0])
 
shell.on("gl-init", function() {
  var gl = shell.gl
  points = createPoints(gl, {
    positions: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    glyphs: [ "●", "■", "★" ]
  })
  axes = createAxes(gl, {
    bounds: [[-1,-1,-1], [1,1,1]]
  })
})
 
shell.on("gl-render", function() {
  var cameraParams = {
    view: camera.view(),
    projection: mat4.perspective(
        mat4.create(),
        Math.PI/4.0,
        shell.width/shell.height,
        0.1,
        1000.0)
  }
  points.draw(cameraParams)
  axes.draw(cameraParams)
})