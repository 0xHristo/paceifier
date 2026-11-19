'use strict';
// Baseline: a plain Array.map never gives the event loop a turn.
const { record } = require('./recorder');

record(async ({ start, item, done, items }) => {
	const values = items('A', 6);
	const work = (value, index) => item('A', value, index);
	start('A', `[${values.map(v => `'${v}'`).join(', ')}].map(work)`);
	values.map(work);
	done('A', `[${values.map(v => `'${v}'`).join(', ')}].map(work) returned`);
});
