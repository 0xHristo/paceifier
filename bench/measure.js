'use strict';
// Measurements used by overhead.js. Each one runs the job once on its own, so
// the instrumentation never affects the timing runs.
const { PerformanceObserver } = require('node:perf_hooks');

async function time(run) {
	const t0 = performance.now();
	await run();
	return performance.now() - t0;
}

const pct = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];

/**
 * Stalls: how long the event loop waited between turns while the job ran.
 * A setImmediate ticker records every gap, including the last one up to the
 * end of the job. A blocking job therefore shows one gap as long as the job.
 */
async function stalls(run) {
	const gaps = [];
	let last = performance.now();
	let done = false;
	(async () => {
		while (!done) {
			await new Promise(r => setImmediate(r));
			if (done) break;
			const t = performance.now();
			gaps.push(t - last);
			last = t;
		}
	})();
	await run();
	gaps.push(performance.now() - last);
	done = true;
	gaps.sort((a, b) => a - b);
	return { turns: gaps.length - 1, p50: pct(gaps, 0.5), p99: pct(gaps, 0.99), max: gaps.at(-1) };
}

const gcEvents = [];
new PerformanceObserver(list => gcEvents.push(...list.getEntries())).observe({ entryTypes: ['gc'] });
const settle = () => new Promise(r => setTimeout(r, 20));

/**
 * Memory: garbage collections during the job (count and total pause time) and
 * the heap still in use after a full GC while the result is kept alive.
 * Needs node --expose-gc; returns null without it.
 */
async function memory(run) {
	if (typeof globalThis.gc !== 'function') return null;
	globalThis.gc();
	await settle();
	const before = process.memoryUsage().heapUsed;
	const from = performance.now();
	const result = await run();
	const to = performance.now();
	await settle(); // let GC entries arrive
	const during = gcEvents.filter(e => e.startTime >= from && e.startTime <= to);
	globalThis.gc();
	const retained = process.memoryUsage().heapUsed - before;
	if (result === undefined) throw new Error('keep the result alive');
	return {
		gcs: during.length,
		gcMs: during.reduce((sum, e) => sum + e.duration, 0),
		retainedMB: retained / 2 ** 20,
	};
}

module.exports = { time, stalls, memory };
