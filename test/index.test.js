'use strict';
// immediate() and the pacing itself, with real time and a real event loop.

const test = require('node:test');
const assert = require('node:assert');
const { immediate, forEachPaced } = require('..');

const tick = () => new Promise(resolve => setImmediate(resolve));

function busy(ms) {
	const end = performance.now() + ms;
	while (performance.now() < end);
}

test('immediate returns undefined at the start of a slice', async () => {
	await tick();
	assert.strictEqual(immediate(), undefined);
});

test('forEachPaced calls fn for every item in order, from any iterable', async () => {
	const seen = [];
	await forEachPaced(new Map([[1, 'a'], [2, 'b'], [3, 'c']]).values(), v => seen.push(v));
	assert.deepStrictEqual(seen, ['a', 'b', 'c']);
});

test('forEachPaced gives the event loop turns during long work', async () => {
	let turns = 0;
	let done = false;
	(async () => {
		while (!done) {
			await tick();
			turns++;
		}
	})();
	await forEachPaced(Array.from({ length: 50 }), () => busy(0.2));
	done = true;
	// 50 x 0.2 ms = 10 ms of work in 1 ms slices.
	assert.ok(turns >= 5, `expected at least 5 turns, got ${turns}`);
});

test('no gap between turns is much longer than a slice', async () => {
	let longest = 0;
	let last = performance.now();
	let done = false;
	(async () => {
		while (!done) {
			await tick();
			const t = performance.now();
			longest = Math.max(longest, t - last);
			last = t;
		}
	})();
	await forEachPaced(Array.from({ length: 200 }), () => busy(0.05));
	done = true;
	assert.ok(longest < 5, `longest gap ${longest.toFixed(2)} ms`);
});

test('concurrent callers both finish and take turns', async () => {
	const order = [];
	await Promise.all(
		['a', 'b'].map(name =>
			forEachPaced(Array.from({ length: 20 }), () => {
				busy(0.3);
				order.push(name);
			}),
		),
	);
	assert.strictEqual(order.filter(x => x === 'a').length, 20);
	assert.strictEqual(order.filter(x => x === 'b').length, 20);
	const switches = order.filter((x, i) => i > 0 && x !== order[i - 1]).length;
	assert.ok(switches > 1, `expected interleaving, got ${switches} switches`);
});

test('an error thrown by fn rejects forEachPaced', async () => {
	await assert.rejects(
		forEachPaced([1, 2, 3], v => {
			if (v === 2) throw new Error('boom');
		}),
		/boom/,
	);
});

test('forEachPaced passes the index like forEach', async () => {
	const seen = [];
	await forEachPaced(['a', 'b'], (v, i) => seen.push([v, i]));
	assert.deepStrictEqual(seen, [['a', 0], ['b', 1]]);
});
