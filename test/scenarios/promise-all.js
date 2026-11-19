'use strict';
// Three mapPaced jobs running together with Promise.all.
const { record } = require('./recorder');
const { mapPaced } = require('../..');

record(({ start, item, done, items }) =>
	Promise.all(
		['A', 'B', 'C'].map(async job => {
			const values = items(job, 4);
			const work = (value, index) => item(job, value, index);
			start(job, `mapPaced([${values.map(v => `'${v}'`).join(', ')}], work)`);
			await mapPaced(values, work);
			done(job, `mapPaced([${values.map(v => `'${v}'`).join(', ')}], work) resolved`);
		}),
	),
);
