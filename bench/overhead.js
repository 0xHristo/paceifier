'use strict';
// mapPaced against a blocking Array.map doing the same work. Real timing on a
// quiet event loop, median of RUNS runs after a warm-up, then one extra run each
// for stalls and one for memory.
// Usage: node --expose-gc bench/overhead.js [--json]
// PACEIFIER=<dir> benchmarks another copy of the library (used by compare.js).
const path = require('node:path');
const { mapPaced } = require(path.resolve(process.env.PACEIFIER ?? path.join(__dirname, '..')));
const { time, stalls, memory } = require('./measure');

const JSON_OUT = process.argv.includes('--json');
const RUNS = Number(process.env.RUNS ?? 7);

function spin(iterations) {
	let x = 0;
	for (let i = 0; i < iterations; i++) x = (x + i * 31) % 1000003;
	return x;
}
// The same callback with more and more work per item, from one multiplication
// to longer than half a slice. The table prints the measured time per item.
const workloads = [
	{ name: 'x * 2', items: 1_000_000, fn: x => x * 2 },
	{ name: '100-step loop', items: 500_000, fn: x => spin(100) + x },
	{ name: '1k-step loop', items: 100_000, fn: x => spin(1_000) + x },
	{ name: '10k-step loop', items: 10_000, fn: x => spin(10_000) + x },
	{ name: '150k-step loop', items: 500, fn: x => spin(150_000) + x },
];

const median = xs => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];

async function measure(run) {
	await time(run); // warm-up
	const times = [];
	for (let r = 0; r < RUNS; r++) times.push(await time(run));
	return { ms: median(times), stalls: await stalls(run), memory: await memory(run) };
}

(async () => {
	const started = performance.now();
	const results = [];
	for (const w of workloads) {
		const data = Array.from({ length: w.items }, (_, i) => i);
		results.push({
			name: w.name,
			items: w.items,
			blocking: await measure(async () => data.map(w.fn)),
			paced: await measure(() => mapPaced(data, w.fn)),
		});
	}
	if (JSON_OUT) return console.log(JSON.stringify(results));
	require('./report').print(results, RUNS);
	console.log(`\nbenchmark took ${((performance.now() - started) / 1000).toFixed(1)} s`);
})();
