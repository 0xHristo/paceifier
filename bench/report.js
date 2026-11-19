'use strict';
// Prints overhead.js results as three tables: time, stalls and memory.
const n = (x, d = 1) => x.toFixed(d);
// Time one item takes in the blocking run, e.g. "4.2 µs" or "0.59 ms".
function perItem(r) {
	const us = (r.blocking.ms * 1000) / r.items;
	if (us >= 100) return `${n(us / 1000, 2)} ms`;
	if (us >= 1) return `${n(us, 1)} µs`;
	return `${n(us * 1000, 0)} ns`;
}
const label = r => `${r.name}, ${perItem(r)}`;
const row = cells => cells.map(([v, w]) => String(v)[w < 0 ? 'padEnd' : 'padStart'](Math.abs(w))).join(' ');

function print(results, runs) {
	console.log(`node ${process.version}, median of ${runs} runs\n`);

	console.log('TIME');
	console.log(row([['callback, time per item', -26], ['items', 9], ['Array.map', 11], ['mapPaced', 11], ['slower', 8], ['overhead/item', 14]]));
	for (const r of results) {
		const b = r.blocking.ms;
		const p = r.paced.ms;
		console.log(row([[label(r), -26], [r.items, 9], [`${n(b)} ms`, 11], [`${n(p)} ms`, 11],
			[`${n(((p - b) / b) * 100, 0)}%`, 8], [`${n(((p - b) * 1e6) / r.items, 0)} ns`, 14]]));
	}
	const tb = results.reduce((sum, r) => sum + r.blocking.ms, 0);
	const tp = results.reduce((sum, r) => sum + r.paced.ms, 0);
	console.log(row([['total', -26], ['', 9], [`${n(tb)} ms`, 11], [`${n(tp)} ms`, 11], [`${n(((tp - tb) / tb) * 100, 0)}%`, 8], ['', 14]]));

	console.log('\nSTALLS (gaps between event-loop turns while the job runs)');
	console.log(row([['callback, time per item', -26], ['Array.map max', 14], ['mapPaced p50', 13], ['p99', 9], ['max', 9], ['turns', 7]]));
	for (const r of results) {
		const s = r.paced.stalls;
		console.log(row([[label(r), -26], [`${n(r.blocking.stalls.max)} ms`, 14], [`${n(s.p50, 2)} ms`, 13],
			[`${n(s.p99, 2)} ms`, 9], [`${n(s.max, 2)} ms`, 9], [s.turns, 7]]));
	}

	if (!results[0].paced.memory) return console.log('\n(memory skipped: run with node --expose-gc)');
	console.log('\nMEMORY (GCs during the job, heap kept after a full GC)');
	console.log(row([['callback, time per item', -26], ['Array.map GCs', 14], ['GC time', 9], ['kept', 9], ['mapPaced GCs', 13], ['GC time', 9], ['kept', 9]]));
	for (const r of results) {
		const b = r.blocking.memory;
		const p = r.paced.memory;
		console.log(row([[label(r), -26], [b.gcs, 14], [`${n(b.gcMs)} ms`, 9], [`${n(Math.max(0, b.retainedMB))} MB`, 9],
			[p.gcs, 13], [`${n(p.gcMs)} ms`, 9], [`${n(Math.max(0, p.retainedMB))} MB`, 9]]));
	}
}

module.exports = { print };
