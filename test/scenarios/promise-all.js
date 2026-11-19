'use strict';
// Three mapPaced jobs running together with Promise.all.
const { record } = require('./recorder');
const { mapPaced } = require('../..');
const items = Array.from({ length: 4 }, (_, i) => i);

record(({ start, item, done }) =>
	Promise.all(
		['A', 'B', 'C'].map(async job => {
			start(job);
			await mapPaced(items, i => item(job, i));
			done(job);
		}),
	),
);
