"use strict"

var vectorizeText = require("vectorize-text")

module.exports = getGlyph

var GLYPH_CACHE = {}

function getGlyph(symbol) {
  if(symbol in GLYPH_CACHE) {
    return GLYPH_CACHE[symbol]
  }
  return GLYPH_CACHE[symbol] = [
    vectorizeText(symbol, {
      triangles: true,
      textAlign: "center",
      textBaseline: "middle",
      lineHeight: 1.0
    }),
    vectorizeText(symbol, {
      textAlign: "center",
      textBaseline: "middle",
      lineHeight: 1.0
    }) 
  ]
}