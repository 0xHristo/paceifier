'use strict';

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
		return require('timers').setImmediate;
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
	const next = waiting.shift();
	if (next !== undefined) {
		startSlice(now());
		next();
	}
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
