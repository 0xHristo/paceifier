'use strict';
// The same three mapPaced jobs, one after another in a for loop.
const { record } = require('./recorder');
const { mapPaced } = require('../..');
const items = Array.from({ length: 4 }, (_, i) => i);

record(async ({ start, item, done }) => {
	for (const job of ['A', 'B', 'C']) {
		start(job);
		await mapPaced(items, i => item(job, i));
		done(job);
	}
});
