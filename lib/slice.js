'use strict';
// immediate() and the slices it measures. A slice starts on the first call and
// ends in a setImmediate callback, which resumes the callers that ran out of time.

const SLICE_MS = 1;
let sliceStart = 0;
let inSlice = false;
const now = globalThis.performance.now.bind(globalThis.performance);
const schedule = realSetImmediate();

function realSetImmediate() {
	for (const fn of [timersSetImmediate(), globalThis.setImmediate]) {
		if (typeof fn === 'function' && fn.clock === undefined) return fn;
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
	sliceStart = time;
	schedule(endSlice);
}

function endSlice() {
	inSlice = false;
	if (waiting.length === 0) return;
	startSlice(now());
	resumeNext();
}

// Resumes waiting callers one after another within the same turn, until the
// slice is used up. resolve() only queues the caller's continuation, so the
// time is checked in a microtask queued after it. By then the caller has done
// its synchronous work and either paused again or finished. This relies on the
// caller awaiting the promise from immediate() directly.
function resumeNext() {
	waiting.shift()();
	queueMicrotask(() => {
		if (waiting.length > 0 && now() - sliceStart < SLICE_MS) resumeNext();
	});
}

function immediate() {
	const time = now();
	if (!inSlice) {
		startSlice(time);
		return undefined;
	}
	if (time - sliceStart < SLICE_MS) return undefined;

	return new Promise(resolve => waiting.push(resolve));
}

module.exports = { immediate };
