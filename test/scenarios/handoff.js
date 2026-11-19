'use strict';
// Two jobs of 3 items with Promise.all. A finishes halfway through its second
// slice, so B resumes in the same turn and uses the rest of that slice.
const { record } = require('./recorder');
const { mapPaced } = require('../..');

record(({ start, item, done, items }) =>
	Promise.all(
		['A', 'B'].map(async job => {
			const values = items(job, 3);
			const work = (value, index) => item(job, value, index);
			start(job, `mapPaced([${values.map(v => `'${v}'`).join(', ')}], work)`);
			await mapPaced(values, work);
			done(job, `mapPaced([${values.map(v => `'${v}'`).join(', ')}], work) resolved`);
		}),
	),
);
