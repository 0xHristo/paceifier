'use strict';
// The same three mapPaced jobs, one after another in a for loop.
const { record } = require('./recorder');
const { mapPaced } = require('../..');

record(async ({ start, item, done, items }) => {
	for (const job of ['A', 'B', 'C']) {
		const values = items(job, 4);
		const work = (value, index) => item(job, value, index);
		start(job, `mapPaced([${values.map(v => `'${v}'`).join(', ')}], work)`);
		await mapPaced(values, work);
		done(job, `mapPaced([${values.map(v => `'${v}'`).join(', ')}], work) resolved`);
	}
});
