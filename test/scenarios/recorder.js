'use strict';
// Records the real order of execution of a scenario and prints it, one line per
// step. Each line starts with the event-loop iteration it ran in (#1 is the
// iteration the recording starts in), then what ran it:
//   io:         an I/O callback (a real fs.stat chain runs alongside the jobs)
//   immediate:  a setImmediate callback, such as the one that ends a slice
//   microtask:  a job resumed in the same turn by the job before it
//   <job>:      the job's own work, pauses and completion
// Nothing is faked. setImmediate is wrapped only to see which callback runs,
// and the real one still does the scheduling. No times are printed, so the
// output can be compared with a stored snapshot.
//
// Items cost 0.67 ms, so a 1 ms slice fits 2 of them. The slice is checked at
// 0.67 ms, under 1 ms, and at 1.33 ms, over it, which leaves a 0.33 ms margin on
// both sides and keeps the order stable despite real timing noise.
const fs = require('node:fs');
const timers = require('node:timers');

const ITEM_MS = 0.67;
let events = null; // null while warming up
let loop = 0; // event-loop iteration of the recorded run
const push = e => events?.push({ ...e, loop });

const realSetImmediate = timers.setImmediate;
timers.setImmediate = (cb, ...args) =>
	realSetImmediate(() => {
		push({ kind: 'immediate', name: cb.name || 'callback' });
		cb(...args);
	});

function busy(ms) {
	const end = performance.now() + ms;
	while (performance.now() < end);
}

const hooks = {
	start: job => push({ kind: 'start', job }),
	item: (job, index) => {
		push({ kind: 'item', job, index });
		busy(ITEM_MS);
	},
	done: job => push({ kind: 'done', job }),
};

function record(scenario) {
	(async () => {
		// Counting iterations. Every iteration polls for I/O before it runs
		// setImmediate callbacks. The fs.stat chain completes once per iteration,
		// so its callback starts a new number. The ticker runs first among the
		// setImmediate callbacks, and starts a new number for an iteration that
		// had no I/O callback.
		let running = true;
		let ioThisLoop = false;
		(function io() {
			fs.stat(__filename, () => {
				if (!running) return;
				loop++;
				ioThisLoop = true;
				push({ kind: 'io' });
				io();
			});
		})();
		(function ticker() {
			if (!running) return;
			if (!ioThisLoop) loop++;
			ioThisLoop = false;
			realSetImmediate(ticker);
		})();
		// Warm up unrecorded, so V8 has compiled the code and libuv has started
		// its thread pool before the recorded run.
		await scenario(hooks);
		await new Promise(r => setTimeout(r, 5));
		events = [];
		loop = 1;
		ioThisLoop = true; // the ticker's next run is still in this iteration
		await scenario(hooks);
		// One more event-loop turn, so callbacks the jobs held back still show.
		await new Promise(r => realSetImmediate(r));
		running = false;
		process.stdout.write(format(events));
	})();
}

// Turns the events into lines. Consecutive items of one job share a line, e.g.
// "A: items 0, 1". Pauses and resumes are worked out from the order: a job that
// started, or ran an item, and is followed by something else has paused.
function format(events) {
	const lines = [];
	const add = (e, text) => lines.push(`#${e.loop} ${text}`);
	const paused = new Set();
	let lastWasEndSlice = false;
	for (let i = 0; i < events.length; i++) {
		const e = events[i];
		if (e.kind === 'io') add(e, 'io: callback');
		if (e.kind === 'immediate') add(e, `immediate: ${e.name}`);
		if (e.kind === 'start') add(e, `${e.job}: start`);
		if (e.kind === 'done') add(e, `${e.job}: done`);
		if (e.kind === 'start' && events[i + 1]?.job !== e.job) {
			add(e, `${e.job}: pause before item 0`);
			paused.add(e.job);
		}
		if (e.kind === 'item') {
			if (paused.delete(e.job)) {
				add(e, lastWasEndSlice ? `immediate: resume ${e.job}` : `microtask: resume ${e.job}`);
			}
			let j = i;
			while (events[j + 1]?.kind === 'item' && events[j + 1].job === e.job) j++;
			const indexes = events.slice(i, j + 1).map(x => x.index);
			add(e, `${e.job}: ${indexes.length > 1 ? 'items' : 'item'} ${indexes.join(', ')}`);
			const next = events.slice(j + 1).find(x => x.job === e.job);
			if (next?.kind === 'item' && events[j + 1] !== next) {
				add(events[j], `${e.job}: pause before item ${next.index}`);
				paused.add(e.job);
			}
			i = j;
		}
		lastWasEndSlice = e.kind === 'immediate' && e.name === 'endSlice';
	}
	return lines.join('\n') + '\n';
}

module.exports = { record };
