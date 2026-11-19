'use strict';
// The same three mapPaced jobs, one after another in a for loop.
const { mapPaced } = require('../..');
const { record } = require('./recorder');
const items = Array.from({ length: 5 }, (_, i) => i);

record(async item => {
	for (const job of ['A', 'B', 'C']) await mapPaced(items, i => item(job, i));
});
