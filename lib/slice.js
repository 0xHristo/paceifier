'use strict';
// pace() and the slices it measures. A slice starts on the first call and
// ends in a setImmediate callback, which resumes the callers that ran out of time.

const SLICE_MS = 1;
// The time the current slice ends. All callers share it on purpose, because a
// slice belongs to the event-loop turn, not to one caller. Concurrent jobs that
// run in the same turn spend one budget together, so the loop waits about
// SLICE_MS however many of them there are.
let deadline = 0;
let inSlice = false;
const now = globalThis.performance.now.bind(globalThis.performance);
const schedule = realSetImmediate();

function realSetImmediate() {
	for (const fn of [timersSetImmediate(), globalThis.setImmediate]) {
		if (typeof fn === 'function' && fn.clock === undefined) {
			return fn;
		}
	}
	const { setTimeout } = globalThis;
	return callback => setTimeout(callback, 0);
}

function timersSetImmediate() {
	try {
		return require('node:timers').setImmediate;
	} catch {
		return undefined;
	}
}

const waiting = [];

function startSlice(time) {
	inSlice = true;
	deadline = time + SLICE_MS;
	schedule(endSlice);
}

function endSlice() {
	inSlice = false;
	if (waiting.length === 0) {
		return;
	}
	startSlice(now());
	resumeNext();
}

// Resumes waiting callers one after another within the same turn, until the
// slice is used up. resolve() only queues the caller's continuation, so the
// time is checked in a microtask queued after it. By then the caller has done
// its synchronous work and either paused again or finished. This relies on the
// caller awaiting the promise from pace() directly.
function resumeNext() {
	waiting.shift()();
	queueMicrotask(() => {
		if (waiting.length > 0 && now() < deadline) {
			resumeNext();
		}
	});
}

function pace() {
	const time = now();
	if (!inSlice) {
		startSlice(time);
		return undefined;
	}
	if (time < deadline) {
		return undefined;
	}
	return new Promise(resolve => {
		waiting.push(resolve);
	});
}

module.exports = { pace };
