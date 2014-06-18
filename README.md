gl-scatter-plot
===============
3D WebGL scatter plots with custom point glyphs.

<img src="scatterplot.png">

# Example

```javascript
var shell = require("gl-now")({tickRate: 2})
var camera = require("game-shell-orbit-camera")(shell)
var createPoints = require("gl-scatter-plot")
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
```

# Install

```
npm install gl-scatter-plot
```

# API

```javascript
var createScatterPlot = require("gl-scatter-plot")
```

## Constructor

#### `var points = createScatterPlot(gl, options)`
Constructs a scatter plot with the given parameters.  

* `gl` is a WebGL context
* `options` is a JSON object containing configuration data for the scatter plot.  For more information, see the documentation in the `.update` method

**Returns** A new scatter plot object

## Method

#### `points.update(options)`
Updates the scatter plot object.  The parameter `options` is an object with the following properties:

* `position` (Required) an array of length 3 arrays encoding the position of the points in the scatter plot.
* `color` A length 3 array encoding the color of the points in the scatter plot.  To set colors per point, pass an array instead.  Default is `[0,0,0]`
* `glyph` The glyph of each point.  This is a UTF8 string representing some shape.  Per point glyphs can be specified by passing an array.  The default glyph is a circle, `"●"`.  For more glyph ideas, check out the [unicode character set](http://unicode-table.com/en/).  Some other fun suggestions: `"☢", "☯", "❤", "▲", "⚑"`. 
* `size` The size of each point, or specified per-point using an array.  Default is `1.0`
* `orthographic` A flag, which if set to `true` causes the points to be drawn without perspective scaling.
* `pickId` An 8 bit value which determines the tag for all elements within the pick buffer

#### `points.draw(camera)`
Draws the scatter plot with the given camera parameters.

* `camera` is a JSON object storing the camera parameters for the point cloud.  It has the following properties:

    + `model` the model matrix, encoded as a length 16 array
    + `view` the view matrix of the camera, encoded as a length 16 array
    + `projection` the projection matrix of the camera, encoded as a length 16 array

#### `points.dispose()`
Destroys the scatter plot object and releases all stored resources.

#### `points.drawPick(camera)`
Draws the scatter plot into a pick buffer for point selection purposes.

* `camera` is a camera object, with the same properties as in `draw`

#### `points.pick(pickId)`
Given an id from the pick buffer, test if the selected value is one of the points in the point cloud.

* `pickId` is a 32 bit integer representing the picking value to test

**Returns** The index of the point in the point cloud which is selected, or `-1` if the index is not in the point cloud

#### `points.highlight(pointId, highlightColor)`
Highlights the point with index `pointId` in the scatter plot by changing its color to `highlightColor`

* `pointId` is the index of a point in the scatter plot
* `highlightColor` is the color to draw the highlighted point with

If this function is called with no arguments, then it will deselect the currently highlighted point.

## Properties

#### `points.bounds`
Lower and upper bounds on the point cloud

# Credits
(c) 2014 Mikola Lysenko. MIT License.  Supported by [plot.ly](https://plot.ly/)