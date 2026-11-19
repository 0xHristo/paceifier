'use strict';
// Three forEachPaced jobs of 4 items running together with Promise.all.
const { record } = require('./recorder');
const { forEachPaced } = require('../..');

record(({ start, item, done, items }) =>
	Promise.all(
		['A', 'B', 'C'].map(async job => {
			const values = items(job, 4);
			const work = (value, index) => item(job, value, index);
			const call = `forEachPaced([${values.map(v => `'${v}'`).join(', ')}], work)`;
			start(job, call);
			await forEachPaced(values, work);
			done(job, `${call} resolved`);
		}),
	),
);
