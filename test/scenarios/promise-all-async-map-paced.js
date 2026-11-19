'use strict';
// Like promise-all-async-map, but the promise per item is created by mapPaced:
// Promise.all(await mapPaced(values, async work)). The async callbacks run in
// paced slices, and Promise.all then waits for the array of promises.
const { record } = require('./recorder');
const { mapPaced } = require('../..');

record(({ start, item, done, items }) =>
	Promise.all(
		['A', 'B', 'C'].map(async job => {
			const values = items(job, 4);
			const work = (value, index) => item(job, value, index);
			const call = `Promise.all(await mapPaced([${values.map(v => `'${v}'`).join(', ')}], async work))`;
			start(job, call);
			await Promise.all(await mapPaced(values, async (value, index) => work(value, index)));
			done(job, `${call} resolved`);
		}),
	),
);
