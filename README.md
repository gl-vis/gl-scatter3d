gl-scatter-plot
===============
3D WebGL scatter plots with custom point glyphs.

<img src="scatterplot.png">

# Example

```javascript
var shell = require("gl-now")({tickRate: 2})
var camera = require("game-shell-orbit-camera")(shell)
var createPoints = require("../pointcloud")
var createAxes = require("gl-axes")
var mat4 = require("gl-matrix").mat4
 
var points, axes

camera.lookAt(
  [2,2,2],
  [0,0,0],
  [0,1,0])
 
shell.on("gl-init", function() {
  var gl = shell.gl

  points = createPoints(gl, {
    positions: [ [1, 0, -1], [0, 1, -1], [0, 0, 1], [1,1,-1], [1,0,1], [0,1,1] ],
    glyphs: [  "▼", "★", "■", "◆", "✚", "✖" ],
    colors: [ [0,1,0], [0,0,1], [1,1,0], [1,0,1], [0,1,1], [0,0,0] ],
    size: 0.1
  })

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

* `positions` (Required) an array of length 3 arrays encoding the position of the points in the scatter plot.
* `color` A length 3 array encoding the color of the points in the scatter plot.  To set colors per point, use the `colors` option.  Default is `[0,0,0]`
* `glyph` The glyph of each point.  This is a UTF8 string representing some shape.  Per point glyphs can be specified using the `glyphs` plural variant.  The default glyph is a circle, `"●"`.  For more glyph ideas, check out the [unicode character set](http://unicode-table.com/en/).  Some other fun suggestions: `"☢", "☯", "❤", "▲", "⚑"`. 
* `size` The size of each point, or specified per-point using `sizes`.  Default is `1.0`

#### `points.draw(camera)`
Draws the scatter plot with the given camera parameters.

* `camera` is a JSON object storing the camera parameters for the point cloud.  It has the following properties:

    + `model` the model matrix, encoded as a length 16 array
    + `view` the view matrix of the camera, encoded as a length 16 array
    + `projection` the projection matrix of the camera, encoded as a length 16 array

#### `points.dispose()`
Destroys the scatter plot object and releases all stored resources.

# Credits
(c) 2014 Mikola Lysenko. MIT License.  Supported by [plot.ly](https://plot.ly/)