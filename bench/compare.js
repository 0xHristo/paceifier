'use strict';
// Benchmarks the working tree against another git ref, main by default.
// Usage: npm run bench:compare [-- <ref>]
// The base ref is checked out into a temporary git worktree, and both sides run
// the same bench/overhead.js, alternating, ROUNDS times each.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const REF = process.argv[2] ?? 'main';
const ROUNDS = Number(process.env.ROUNDS ?? 3);
const started = performance.now();
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'paceifier-base-'));
git('worktree', 'add', '--detach', base, REF);
const run = dir =>
	JSON.parse(
		execFileSync(process.execPath, ['--expose-gc', path.join(__dirname, 'overhead.js'), '--json'], {
			env: { ...process.env, PACEIFIER: dir },
			encoding: 'utf8',
		}),
	);
const median = xs => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];

try {
	const runs = { base: [], head: [] };
	for (let r = 0; r < ROUNDS; r++) {
		process.stderr.write(`round ${r + 1}/${ROUNDS}\r`);
		runs.base.push(run(base));
		runs.head.push(run(ROOT));
	}
	const sha = git('rev-parse', '--short', REF);
	const change = (b, h) => {
		const pct = ((h - b) / b) * 100;
		return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
	};
	console.log(`mapPaced, ${REF} (${sha}) vs working tree, median of ${ROUNDS} rounds\n`);
	console.log(`${'callback'.padEnd(20)} ${'time'.padStart(9)} ${'now'.padStart(10)} ${'change'.padStart(8)}   ${'p99 stall'.padStart(9)} ${'now'.padStart(8)} ${'change'.padStart(8)}`);
	runs.head[0].forEach((w, i) => {
		const pick = (side, f) => median(runs[side].map(x => f(x[i].paced)));
		const bt = pick('base', p => p.ms);
		const ht = pick('head', p => p.ms);
		const bs = pick('base', p => p.stalls.p99);
		const hs = pick('head', p => p.stalls.p99);
		console.log(
			`${w.name.padEnd(20)} ${bt.toFixed(1).padStart(6)} ms ${ht.toFixed(1).padStart(7)} ms ${change(bt, ht).padStart(8)}   ` +
				`${bs.toFixed(2).padStart(6)} ms ${hs.toFixed(2).padStart(5)} ms ${change(bs, hs).padStart(8)}`,
		);
	});
	const total = side => median(runs[side].map(x => x.reduce((sum, w) => sum + w.paced.ms, 0)));
	const tb = total('base');
	const th = total('head');
	console.log(`${'total'.padEnd(20)} ${tb.toFixed(1).padStart(6)} ms ${th.toFixed(1).padStart(7)} ms ${change(tb, th).padStart(8)}`);
	console.log(`\ncomparison took ${((performance.now() - started) / 1000).toFixed(1)} s`);
} finally {
	git('worktree', 'remove', '--force', base);
}
