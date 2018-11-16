"use strict"

var vectorizeText = require("vectorize-text")

module.exports = getGlyph

var GLYPH_CACHE = {}

function getGlyph(symbol, font) {
  var fontCache = GLYPH_CACHE[font]
  if(!fontCache) {
    fontCache = GLYPH_CACHE[font] = {}
  }
  if(symbol in fontCache) {
    return fontCache[symbol]
  }

  //Get line and triangle meshes for glyph
  var lineSymbol = vectorizeText(symbol, {
      textAlign: "center",
      textBaseline: "middle",
      lineHeight: 1.0,
      font: font,
      lineSpacing: 1.25,
      styletags: {breaklines:true, bolds: true, italics: true, subscripts:true, superscripts:true}
    })
  var triSymbol = vectorizeText(symbol, {
      triangles: true,
      textAlign: "center",
      textBaseline: "middle",
      lineHeight: 1.0,
      font: font,
      lineSpacing: 1.25,
      styletags: {breaklines:true, bolds: true, italics: true, subscripts:true, superscripts:true}
    })

  //Calculate bounding box
  var bounds = [[Infinity,Infinity], [-Infinity,-Infinity]]
  for(var i = lineSymbol.positions.length - 1; i > -1; --i) {
    var p = lineSymbol.positions[i]
    for(var j=0; j<2; ++j) {
      bounds[0][j] = Math.min(bounds[0][j], p[j])
      bounds[1][j] = Math.max(bounds[1][j], p[j])
    }
  }

  //Save cached symbol
  return fontCache[symbol] = [triSymbol, lineSymbol, bounds]
}