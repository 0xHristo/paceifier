'use strict';
// Runs every script in test/scenarios/ for real, in its own process, and
// compares its printed order of execution with test/snapshots/<name>.txt.
// After an intended change, regenerate the snapshots with:
//   npm run test:update
const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const { sideBySide } = require('./side-by-side');
const fs = require('node:fs');
const path = require('node:path');

const SCENARIOS = path.join(__dirname, 'scenarios');
const SNAPSHOTS = path.join(__dirname, 'snapshots');
const UPDATE = process.env.UPDATE_SNAPSHOTS === '1';

const scenarios = fs
	.readdirSync(SCENARIOS)
	.filter(f => f.endsWith('.js') && f !== 'recorder.js')
	.map(f => path.basename(f, '.js'));

// Real timing can rarely shift an item into the next slice, for example when
// the OS pauses the process for a moment. A real change in behaviour fails
// every attempt, so a scenario passes if any of ATTEMPTS runs matches.
const ATTEMPTS = 3;
const run = name => execFileSync(process.execPath, [path.join(SCENARIOS, `${name}.js`)], { encoding: 'utf8' });

for (const name of scenarios) {
	test(`scenario ${name} matches its snapshot`, () => {
		const file = path.join(SNAPSHOTS, `${name}.txt`);
		if (UPDATE || !fs.existsSync(file)) {
			fs.mkdirSync(SNAPSHOTS, { recursive: true });
			fs.writeFileSync(file, run(name));
			return;
		}
		const expected = fs.readFileSync(file, 'utf8');
		let actual;
		for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
			actual = run(name);
			if (actual === expected) return;
		}
		assert.strictEqual(actual, expected);
	});
}

// Side-by-side views, built from two of the snapshots above.
const COMPARISONS = [
	{
		name: 'promise-all-side-by-side',
		left: ['Promise.all with Array.map', 'promise-all-array-map'],
		right: ['Promise.all with mapPaced', 'promise-all'],
	},
	{
		name: 'promise-all-async-map-side-by-side',
		left: ['Promise.all with a promise per item', 'promise-all-async-map'],
		right: ['Promise.all with forEachPaced', 'promise-all-for-each-paced'],
	},
	{
		name: 'map-paced-vs-promise-all-side-by-side',
		left: ['mapPaced(values, work)', 'promise-all'],
		right: ['Promise.all(await mapPaced(values, async work))', 'promise-all-async-map-paced'],
	},
];

for (const c of COMPARISONS) {
	test(`${c.name} matches the snapshots it is built from`, () => {
		const read = name => fs.readFileSync(path.join(SNAPSHOTS, `${name}.txt`), 'utf8');
		const actual = sideBySide(c.left[0], read(c.left[1]), c.right[0], read(c.right[1]));
		const file = path.join(SNAPSHOTS, `${c.name}.txt`);
		if (UPDATE || !fs.existsSync(file)) return fs.writeFileSync(file, actual);
		assert.strictEqual(actual, fs.readFileSync(file, 'utf8'));
	});
}

// mapPaced with a plain callback and Promise.all over mapPaced with an async
// callback must run in exactly the same order. This runs both scenarios live and
// compares their output, after rewriting only the text of the call that starts
// and ends each job. Real timing can rarely shift an item, so it retries.
test('Promise.all(await mapPaced(values, async work)) runs like mapPaced(values, work)', () => {
	const asPlainMapPaced = text =>
		text.replace(/Promise\.all\(await mapPaced\((\[[^\]]*\]), async work\)\)/g, 'mapPaced($1, work)');
	let plain;
	let wrapped;
	for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
		plain = run('promise-all');
		wrapped = asPlainMapPaced(run('promise-all-async-map-paced'));
		if (wrapped === plain) return;
	}
	assert.strictEqual(wrapped, plain);
});
