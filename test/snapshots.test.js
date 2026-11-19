'use strict';
// Runs every script in test/scenarios/ for real, in its own process, and
// compares its printed order of execution with test/snapshots/<name>.txt.
// After an intended change, regenerate the snapshots with:
//   npm run test:update
const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const SCENARIOS = path.join(__dirname, 'scenarios');
const SNAPSHOTS = path.join(__dirname, 'snapshots');
const UPDATE = process.env.UPDATE_SNAPSHOTS === '1';

const scenarios = fs
	.readdirSync(SCENARIOS)
	.filter(f => f.endsWith('.js') && f !== 'recorder.js')
	.map(f => path.basename(f, '.js'));

for (const name of scenarios) {
	test(`scenario ${name} matches its snapshot`, () => {
		const actual = execFileSync(process.execPath, [path.join(SCENARIOS, `${name}.js`)], { encoding: 'utf8' });
		const file = path.join(SNAPSHOTS, `${name}.txt`);
		if (UPDATE || !fs.existsSync(file)) {
			fs.mkdirSync(SNAPSHOTS, { recursive: true });
			fs.writeFileSync(file, actual);
			return;
		}
		assert.strictEqual(actual, fs.readFileSync(file, 'utf8'));
	});
}
