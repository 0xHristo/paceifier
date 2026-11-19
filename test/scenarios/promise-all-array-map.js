'use strict';
// The promise-all scenario with a plain Array.map instead of mapPaced: three
// jobs of 4 items with Promise.all. Array.map never pauses, so each job runs to
// the end before the next one starts, and the event loop waits for all three.
const { record } = require('./recorder');

record(({ start, item, done, items }) =>
	Promise.all(
		['A', 'B', 'C'].map(async job => {
			const values = items(job, 4);
			const work = (value, index) => item(job, value, index);
			start(job, `[${values.map(v => `'${v}'`).join(', ')}].map(work)`);
			values.map(work);
			done(job, `[${values.map(v => `'${v}'`).join(', ')}].map(work) returned`);
		}),
	),
);
