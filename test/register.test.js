'use strict';
// The opt-in methods that paceifier/register adds to arrays and iterators.

const test = require('node:test');
const assert = require('node:assert');
require('../register');

test('register adds non-enumerable methods to arrays', async () => {
	assert.deepStrictEqual(await [1, 2, 3].mapPaced(n => n * 2), [2, 4, 6]);
	assert.strictEqual(await [1, 2, 3].reducePaced((a, n) => a + n, 0), 6);
	for (const key in []) assert.fail(`enumerable key ${key}`);
});

test('register adds the methods to iterators such as Map.values()', async () => {
	const m = new Map([[1, 'a'], [2, 'b']]);
	const seen = [];
	await m.values().forEachPaced(v => seen.push(v));
	assert.deepStrictEqual(seen, ['a', 'b']);
	assert.strictEqual(await m.keys().findPaced(k => k > 1), 2);
});
