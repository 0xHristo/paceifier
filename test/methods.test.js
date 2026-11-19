'use strict';

const test = require('node:test');
const assert = require('node:assert');
const p = require('..');

const nums = [1, 2, 3, 4];

test('mapPaced', async () => {
	assert.deepStrictEqual(await p.mapPaced(nums, (n, i) => n * 10 + i), [10, 21, 32, 43]);
});

test('filterPaced', async () => {
	assert.deepStrictEqual(await p.filterPaced(nums, n => n % 2 === 0), [2, 4]);
});

test('flatMapPaced flattens one level', async () => {
	assert.deepStrictEqual(await p.flatMapPaced(nums, n => (n % 2 ? [n, [n]] : n)), [1, [1], 2, 3, [3], 4]);
});

test('reducePaced with and without an initial value', async () => {
	assert.strictEqual(await p.reducePaced(nums, (a, n) => a + n, 10), 20);
	assert.strictEqual(await p.reducePaced(nums, (a, n) => a + n), 10);
	assert.strictEqual(await p.reducePaced([], (a, n) => a + n, 0), 0);
	await assert.rejects(p.reducePaced([], (a, n) => a + n), TypeError);
});

test('findPaced and findIndexPaced', async () => {
	assert.strictEqual(await p.findPaced(nums, n => n > 2), 3);
	assert.strictEqual(await p.findPaced(nums, n => n > 9), undefined);
	assert.strictEqual(await p.findIndexPaced(nums, n => n > 2), 2);
	assert.strictEqual(await p.findIndexPaced(nums, n => n > 9), -1);
});

test('somePaced and everyPaced, including empty input', async () => {
	assert.strictEqual(await p.somePaced(nums, n => n > 3), true);
	assert.strictEqual(await p.somePaced(nums, n => n > 9), false);
	assert.strictEqual(await p.everyPaced(nums, n => n > 0), true);
	assert.strictEqual(await p.everyPaced(nums, n => n > 1), false);
	assert.strictEqual(await p.somePaced([], () => true), false);
	assert.strictEqual(await p.everyPaced([], () => false), true);
});

test('search methods stop at the first match', async () => {
	let calls = 0;
	await p.somePaced(nums, n => (calls++, n === 2));
	assert.strictEqual(calls, 2);
});

test('works on Map and Set iterators', async () => {
	const m = new Map([['a', 1], ['b', 2]]);
	assert.deepStrictEqual(await p.mapPaced(m.values(), n => n * 2), [2, 4]);
	assert.deepStrictEqual(await p.filterPaced(new Set(nums), n => n > 2), [3, 4]);
});
