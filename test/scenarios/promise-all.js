'use strict';
// Three mapPaced jobs running together with Promise.all.
const { mapPaced } = require('../..');
const { record } = require('./recorder');
const items = Array.from({ length: 5 }, (_, i) => i);

record(item => Promise.all(['A', 'B', 'C'].map(job => mapPaced(items, i => item(job, i)))));
