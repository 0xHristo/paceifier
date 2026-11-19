'use strict';

const { immediate } = require('./slice');

// Each method pauses for an event-loop turn before calling fn whenever the
// current slice has run out. fn is always synchronous.

async function forEachPaced(items, fn) {
	let index = 0;
	for (const item of items) {
		const pause = immediate();
		if (pause) await pause;
		fn(item, index++);
	}
}

async function mapPaced(items, fn) {
	const out = [];
	await forEachPaced(items, (item, index) => out.push(fn(item, index)));
	return out;
}

async function filterPaced(items, fn) {
	const out = [];
	await forEachPaced(items, (item, index) => {
		if (fn(item, index)) out.push(item);
	});
	return out;
}

async function flatMapPaced(items, fn) {
	const out = [];
	await forEachPaced(items, (item, index) => {
		const result = fn(item, index);
		if (Array.isArray(result)) out.push(...result);
		else out.push(result);
	});
	return out;
}

async function reducePaced(items, fn, ...init) {
	let acc = init[0];
	let started = init.length > 0;
	await forEachPaced(items, (item, index) => {
		if (started) acc = fn(acc, item, index);
		else {
			acc = item;
			started = true;
		}
	});
	if (!started) throw new TypeError('Reduce of empty collection with no initial value');
	return acc;
}

// Stops at the first item where test returns true; returns its [item, index].
async function search(items, test) {
	let index = 0;
	for (const item of items) {
		const pause = immediate();
		if (pause) await pause;
		if (test(item, index)) return [item, index];
		index++;
	}
	return undefined;
}

async function findPaced(items, fn) {
	return (await search(items, fn))?.[0];
}

async function findIndexPaced(items, fn) {
	return (await search(items, fn))?.[1] ?? -1;
}

async function somePaced(items, fn) {
	return (await search(items, fn)) !== undefined;
}

async function everyPaced(items, fn) {
	return (await search(items, (item, index) => !fn(item, index))) === undefined;
}

module.exports = {
	forEachPaced,
	mapPaced,
	filterPaced,
	flatMapPaced,
	reducePaced,
	findPaced,
	findIndexPaced,
	somePaced,
	everyPaced,
};
