'use strict';
// Three jobs of 4 items with Promise.all, where each job also wraps every item in
// a promise: Promise.all(values.map(async (value, index) => work(value, index))).
// The async callbacks still run synchronously up to their end, so the promises
// don't give the event loop a turn.
const { record } = require('./recorder');

record(({ start, item, done, items }) =>
	Promise.all(
		['A', 'B', 'C'].map(async job => {
			const values = items(job, 4);
			const work = (value, index) => item(job, value, index);
			const call = `Promise.all([${values.map(v => `'${v}'`).join(', ')}].map(async work))`;
			start(job, call);
			await Promise.all(values.map(async (value, index) => work(value, index)));
			done(job, `${call} resolved`);
		}),
	),
);
