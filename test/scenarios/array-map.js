'use strict';
// Baseline: a plain Array.map never gives the event loop a turn.
const { record } = require('./recorder');
const items = Array.from({ length: 6 }, (_, i) => i);

record(async ({ start, item, done }) => {
	start('A');
	items.map(i => item('A', i));
	done('A');
});
