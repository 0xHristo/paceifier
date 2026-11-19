'use strict';
// Baseline: a plain Array.map never gives the event loop a turn.
const { record } = require('./recorder');
const items = Array.from({ length: 9 }, (_, i) => i);

record(async item => {
	items.map(i => item('A', i));
});
