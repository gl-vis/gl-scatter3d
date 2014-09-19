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

  //Initialize point cloud
  var initialData = {
    position: [ [1, 0, -1], [0, 1, -1], [0, 0, 1], [1,1,-1], [1,0,1], [0,1,1] ],
    glyph: [  "▼", "★", "■", "◆", "✚", "✖" ],
    color: [ [0,1,0], [0,0,1], [1,1,0], [1,0,1], [0,1,1], [0,0,0] ],
    size: 12,
    orthographic: true
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

function updatePick(cameraParams) {
  //Update size of select buffer
  select.shape = [shell.height, shell.width]

  //Begin pass, look for points within 30 pixels of mouse
  select.begin(shell.mouse[0], shell.mouse[1], 30)

  //Draw point cloud pick buffer
  points.drawPick(cameraParams)

  //End pass, retrieve selection information
  var selected = select.end()

  //Look up point id in scatter plot, mark as highlighted
  var target = points.pick(selected)
  if(target >= 0) {
    points.highlight(target.index, [0,0,0])
  } else {
    points.highlight()
  }
}
 
shell.on("gl-render", function() {
  var gl = shell.gl

  //Compute camera paramters
  var cameraParams = {
    view: camera.view(),
    projection: mat4.perspective(
        mat4.create(),
        Math.PI/4.0,
        shell.width/shell.height,
        0.1,
        1000.0)
  }

  //Turn on z-buffer
  gl.enable(gl.DEPTH_TEST)

  //Update point picking data
  updatePick(cameraParams)

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

### Basic rendering

#### `points.update(options)`
Updates the scatter plot object.  The parameter `options` is an object with the following properties:

* `position` (Required) an array of length 3 arrays encoding the position of the points in the scatter plot.
* `color` A length 3 array encoding the color of the points in the scatter plot.  To set colors per point, pass an array instead.  Default is `[0,0,0]`
* `glyph` The glyph of each point.  This is a UTF8 string representing some shape.  Per point glyphs can be specified by passing an array.  The default glyph is a circle, `"●"`.  For more glyph ideas, check out the [unicode character set](http://unicode-table.com/en/).  Some other fun suggestions: `"☢", "☯", "❤", "▲", "⚑"`. 
* `size` The size of each point, or specified per-point using an array.  In orthographic, this is in screen coordinates, or in perspective this is in world coordinates. Default is `0.1`
* `orthographic` A flag, which if set to `true` causes the points to be drawn without perspective scaling.
* `pickId` An 8 bit value which determines the tag for all elements within the pick buffer
* `lineWidth` the width of the outline (set to 0 for no outline) Default is `0`
* `lineColor` the color of the outline for each marker
* `font` the font used for drawing the glyphs (default `normal`)
* `angle` an angle to rotate the glyphs by in radians (default `0`)
* `alignment` a 2d vector to offset text drawing by (default `[0,0]`)
* `project` a flag (or array of flags) which determines which axes to project onto
* `axisBounds` a pair of 3d arrays representing the bounds of the axes to project onto

#### `points.draw(camera)`
Draws the scatter plot with the given camera parameters.

* `camera` is a JSON object storing the camera parameters for the point cloud.  It has the following properties:

    + `model` the model matrix, encoded as a length 16 array
    + `view` the view matrix of the camera, encoded as a length 16 array
    + `projection` the projection matrix of the camera, encoded as a length 16 array

#### `points.dispose()`
Destroys the scatter plot object and releases all stored resources.

### Picking

#### `points.drawPick(camera)`
Draws the scatter plot into a pick buffer for point selection purposes.

* `camera` is a camera object, with the same properties as in `draw`

#### `points.pick(selected)`
Finds the index of a point selected by some mouse coordinate. 

* `selected` is the selection information returned by calling end on a `gl-select` object

**Returns** An object representing the highlighted point, or `null` if no point is selected. The object has the following properties:

* `index` which is the index of the selected point
* `position` which the 3D position of the selected point in data coordinates

#### `points.highlight(pointId, highlightColor)`
Highlights the point with index `pointId` in the scatter plot by changing its color to `highlightColor`

* `pointId` is the index of a point in the scatter plot
* `highlightColor` is the color to draw the highlighted point with

If this function is called with no arguments, then it will deselect the currently highlighted point.

## Properties

#### `points.bounds`
Lower and upper bounds on the point cloud

#### `points.clipBounds`
A pair of arrays that determine lower and upper bounds on the scatter plot to draw.  These are useful for clipping the scatter plot to a smaller region.

# Credits
(c) 2014 Mikola Lysenko. MIT License.  Supported by [plot.ly](https://plot.ly/)