'use strict';
// Two jobs of 3 items with Promise.all. A finishes halfway through its second
// slice, so B resumes in the same turn and uses the rest of that slice.
const { record } = require('./recorder');
const { mapPaced } = require('../..');
const items = Array.from({ length: 3 }, (_, i) => i);

record(({ start, item, done }) =>
	Promise.all(
		['A', 'B'].map(async job => {
			start(job);
			await mapPaced(items, i => item(job, i));
			done(job);
		}),
	),
);
