'use strict';

// Each export is assigned on its own line, so ESM loaders (Node, Deno, Bun) can
// detect the named exports of this CommonJS file without running it.
const { pace } = require('./lib/slice');
const methods = require('./lib/methods');

exports.pace = pace;
exports.forEachPaced = methods.forEachPaced;
exports.mapPaced = methods.mapPaced;
exports.filterPaced = methods.filterPaced;
exports.flatMapPaced = methods.flatMapPaced;
exports.reducePaced = methods.reducePaced;
exports.findPaced = methods.findPaced;
exports.findIndexPaced = methods.findIndexPaced;
exports.somePaced = methods.somePaced;
exports.everyPaced = methods.everyPaced;
