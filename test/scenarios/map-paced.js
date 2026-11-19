'use strict';
// One mapPaced over 9 items.
const { mapPaced } = require('../..');
const { record } = require('./recorder');
const items = Array.from({ length: 9 }, (_, i) => i);

record(item => mapPaced(items, i => item('A', i)));
