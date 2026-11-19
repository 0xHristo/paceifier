'use strict';
// Blueprint of what runs, in order, when three export jobs share the event loop.
// A fake clock makes it deterministic: every item costs exactly 0.25 ms, and a
// "turn" line marks each event-loop turn other work (I/O) would get.
const test = require('node:test');
const assert = require('node:assert');
const timers = require('node:timers');

let clock = 0;
Object.defineProperty(performance, 'now', { value: () => clock, configurable: true });

const log = [];
const realSetImmediate = timers.setImmediate;
timers.setImmediate = (cb, ...args) =>
	realSetImmediate(() => {
		if (cb.name === 'endSlice') log.push('immediate: endSlice');
		cb(...args);
	});
const { immediate } = require('..');

async function exportJob(name, items) {
	for (let i = 1; i <= items; i++) {
		const pause = immediate();
		if (pause !== undefined) {
			log.push(`${name}: pause before item ${i}`);
			await pause;
			log.push(`immediate: resume ${name}`);
		}
		clock += 0.25; // 0.25 ms of work per item
	}
	log.push(`${name}: done`);
}

// Marks event-loop turns until the jobs finish.
function turns() {
	let done = false;
	(function turn() {
		if (done) return;
		log.push('turn');
		realSetImmediate(turn);
	})();
	return () => (done = true);
}

async function run(mode, items = 8) {
	await new Promise(r => realSetImmediate(r)); // let any old slice end
	log.length = 0;
	const jobs = [['H1', items], ['H2', items], ['H3', items]];
	const stop = turns();
	if (mode === 'all') await Promise.all(jobs.map(([n, i]) => exportJob(n, i)));
	else for (const [n, i] of jobs) await exportJob(n, i);
	stop();
	return log.slice();
}

const resume = name => ['turn', 'immediate: endSlice', `immediate: resume ${name}`];

test('Promise.all: paused jobs resume one per turn, in order', async () => {
	assert.deepStrictEqual(await run('all'), [
		'turn',
		// H1 uses the first 1 ms slice. H2 and H3 find it used up and queue.
		'H1: pause before item 5',
		'H2: pause before item 1',
		'H3: pause before item 1',
		// Each turn resumes exactly one job with a fresh 1 ms slice.
		...resume('H1'), 'H1: done',
		...resume('H2'), 'H2: pause before item 5',
		...resume('H3'), 'H3: pause before item 5',
		...resume('H2'), 'H2: done',
		...resume('H3'), 'H3: done',
	]);
});

test('for loop: one job at a time, pausing every 1 ms', async () => {
	assert.deepStrictEqual(await run('for'), [
		'turn',
		'H1: pause before item 5',
		...resume('H1'), 'H1: done',
		// H1 used up the slice, so H2 pauses before doing any work.
		'H2: pause before item 1',
		...resume('H2'), 'H2: pause before item 5',
		...resume('H2'), 'H2: done',
		'H3: pause before item 1',
		...resume('H3'), 'H3: pause before item 5',
		...resume('H3'), 'H3: done',
	]);
});

test('a job that finishes mid-slice hands the rest of the slice to the next', async () => {
	assert.deepStrictEqual(await run('all', 6), [
		'turn',
		'H1: pause before item 5',
		'H2: pause before item 1',
		'H3: pause before item 1',
		// H1 needs only 0.5 ms more, so H2 resumes in the same turn.
		...resume('H1'), 'H1: done',
		'immediate: resume H2', 'H2: pause before item 3',
		...resume('H3'), 'H3: pause before item 5',
		// H2 uses its whole slice, so H3 waits for the next turn.
		...resume('H2'), 'H2: done',
		...resume('H3'), 'H3: done',
	]);
});
