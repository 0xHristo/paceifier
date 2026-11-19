'use strict';
// Prints what happens, in order, when export jobs share the event loop with I/O.
// Usage: node examples/trace.js all   (jobs run together with Promise.all)
//        node examples/trace.js for   (jobs run one after another in a for loop)
const fs = require('node:fs');
const timers = require('node:timers');

// Log every callback paced schedules, before paced captures setImmediate.
const realSetImmediate = timers.setImmediate;
timers.setImmediate = (cb, ...args) =>
	realSetImmediate(() => {
		if (cb.name === 'endSlice') console.log('immediate: endSlice');
		cb(...args);
	});
const { immediate } = require('..');

async function exportJob(name, items) {
	for (let i = 1; i <= items; i++) {
		const pause = immediate();
		if (pause !== undefined) {
			console.log(`${name}: pause before item ${i}`);
			await pause;
			console.log(`immediate: resume ${name}`);
		}
		const end = performance.now() + 0.25; // 0.25 ms of work per item
		while (performance.now() < end);
	}
	console.log(`${name}: done`);
}

let ios = 0;
(function io() {
	if (ios++) console.log('io: callback');
	if (ios < 12) fs.stat(__filename, io);
})();

const jobs = [['H1', 8], ['H2', 8], ['H3', 8]];

if (process.argv[2] === 'for') {
	(async () => {
		for (const [name, items] of jobs) await exportJob(name, items);
	})();
} else {
	Promise.all(jobs.map(([name, items]) => exportJob(name, items)));
}
