var shell = require("gl-now")({tickRate: 2})
var camera = require("game-shell-orbit-camera")(shell)
var createPoints = require("../pointcloud")
var createAxes = require("gl-axes")
var createSelect = require("gl-select")
var mat4 = require("gl-matrix").mat4
 
var points, axes, select

camera.lookAt(
  [2,2,2],
  [0.5,0.5,0.5],
  [0,1,0])
 
shell.on("gl-init", function() {
  var gl = shell.gl

  var initialData = {
    position: [ [1, 0, -1], [0, 1, -1], [0, 0, 1], [1,1,-1], [1,0,1], [0,1,1] ],
    glyph: [  "▼", "★", "■", "◆", "✚", "✖" ],
    color: [ [0,1,0], [0,0,1], [1,1,0], [1,0,1], [0,1,1], [0,0,0] ],
    size: 12,
    orthographic: true,
  }

  for(var i=0; i<100; ++i) {
    var theta = i / 100.0 * 2.0 * Math.PI
    var x = Math.cos(theta)
    var y = Math.sin(theta)
    initialData.position.push([ x, y, 0 ])
    initialData.glyph.push("●")
    initialData.color.push([1, 0, 0])
  }

  points = createPoints(gl, initialData)

  axes = createAxes(gl, {
    bounds: [[-1,-1, -1], [1,1,1]],
    tickSpacing: [.1, .1, .1]
  })

  select = createSelect(gl, [shell.height, shell.width])
})


function updatePick(camera) {
  //Do a pass on the pick buffer to update point selections
  select.shape = [shell.height, shell.width]
  select.begin(shell.mouse[0], shell.mouse[1], 30)

  //Draw point cloud pick buffer
  points.drawPick(cameraParams)

  //Retrieve closest point
  var selected = select.end()
  if(selected) {

    //Look up id in scatter plot
    var pointId = points.pick(selected.id)
    if(pointId >= 0) {
      points.highlight(pointId, [0,0,0])
    }
  } else {
    points.highlight()
  }
}

 
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

  //Update point picking data
  updatePick(camera)

  //Update camera
  points.draw(cameraParams)
  axes.draw(cameraParams)
})