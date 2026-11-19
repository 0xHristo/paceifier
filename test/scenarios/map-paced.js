'use strict';
// One mapPaced over 6 items.
const { record } = require('./recorder');
const { mapPaced } = require('../..');
const items = Array.from({ length: 6 }, (_, i) => i);

record(async ({ start, item, done }) => {
	start('A');
	await mapPaced(items, i => item('A', i));
	done('A');
});
