'use strict';
// Records the real order of execution of a scenario and prints it as a table:
// the event-loop iteration, the phase of the loop, and the step that ran.
// test/snapshots/README.md explains how to read it.
//
// Nothing is faked. Alongside the jobs, real background work puts a callback
// into every phase that can run JavaScript, in every iteration:
//   timers   a setTimeout(0) chain
//   pending  net.connect to a missing Unix socket; libuv defers its error here
//   poll     an fs.stat chain, which also queues a nextTick and a microtask
//   check    paceifier's own setImmediate, seen through a wrapper that still
//            schedules with the real setImmediate
//   close    the failed socket's close event, which starts the next connect
// The idle and prepare phases run only libuv's own code, so they never show.
// No times are printed, so the output can be compared with a stored snapshot.
//
// Items cost 0.67 ms, so a 1 ms slice fits 2 of them. The slice is checked at
// 0.67 ms, under 1 ms, and at 1.33 ms, over it, which leaves a 0.33 ms margin on
// both sides and keeps the order stable despite real timing noise.
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const timers = require('node:timers');

const ITEM_MS = 0.67;
const MISSING_SOCKET = path.join(__dirname, 'no-such.sock');
const PHASES = ['timers', 'pending', 'poll', 'check', 'close'];

let events = null; // null while warming up
let running = true;
let phase = 'timers'; // phase of the callback that is running now
let onClose = null; // called after the next close-phase callback

const push = e => events?.push({ ...e, phase });

const realSetImmediate = timers.setImmediate;
timers.setImmediate = (cb, ...args) =>
	realSetImmediate(() => {
		phase = 'check';
		push({ kind: 'immediate', name: cb.name || 'callback' });
		cb(...args);
	});

function background() {
	(function timeout() {
		setTimeout(() => {
			if (!running) return;
			phase = 'timers';
			push({ kind: 'step', text: 'timeout: callback' });
			timeout();
		}, 0);
	})();
	(function io() {
		fs.stat(__filename, () => {
			if (!running) return;
			phase = 'poll';
			push({ kind: 'step', text: 'io: callback' });
			process.nextTick(() => push({ kind: 'step', text: 'nextTick: callback' }));
			queueMicrotask(() => push({ kind: 'step', text: 'microtask: callback' }));
			io();
		});
	})();
	(function connect() {
		const socket = net.connect(MISSING_SOCKET);
		socket.on('error', () => {
			phase = 'pending';
			push({ kind: 'step', text: 'socket: connect error' });
		});
		socket.on('close', () => {
			if (!running) return;
			phase = 'close';
			push({ kind: 'step', text: 'socket: closed' });
			onClose?.();
			connect();
		});
	})();
}

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
	background();
	(async () => {
		// Warm up unrecorded, so V8 has compiled the code and libuv has started
		// its thread pool before the recorded run.
		await scenario(hooks);
		await new Promise(r => setTimeout(r, 5));
		phase = 'timers'; // the recording starts in the setTimeout callback above
		events = [];
		await scenario(hooks);
		// Finish the iteration the jobs ended in, up to its close phase.
		await new Promise(r => (onClose = r));
		running = false;
		process.stdout.write(format(events));
		process.exit(0);
	})();
}

module.exports = { record };

// Turns the events into table rows. A new iteration starts whenever the phase
// goes back in the loop's order, e.g. from close to timers. Consecutive items of
// one job share a row, e.g. "A: items 0, 1". Pauses and resumes are worked out
// from the order: a job followed by something other than its next item paused.
function format(events) {
	const lines = ['loop  phase    step'];
	let loop = 1;
	let last = 0;
	const add = (e, text) => {
		const index = PHASES.indexOf(e.phase);
		if (index < last) loop++;
		last = index;
		lines.push(`${`#${loop}`.padEnd(5)} ${e.phase.padEnd(8)} ${text}`);
	};
	const paused = new Set();
	let lastWasEndSlice = false;
	for (let i = 0; i < events.length; i++) {
		const e = events[i];
		if (e.kind === 'step') add(e, e.text);
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
