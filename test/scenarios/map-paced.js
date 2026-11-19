'use strict';
// One mapPaced over 6 items.
const { record } = require('./recorder');
const { mapPaced } = require('../..');

record(async ({ start, item, done, items }) => {
	const values = items('A', 6);
	const work = (value, index) => item('A', value, index);
	start('A', `mapPaced([${values.map(v => `'${v}'`).join(', ')}], work)`);
	await mapPaced(values, work);
	done('A', `mapPaced([${values.map(v => `'${v}'`).join(', ')}], work) resolved`);
});
