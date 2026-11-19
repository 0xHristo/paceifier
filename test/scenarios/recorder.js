'use strict';
// Records the real order of execution of a scenario and prints it. Nothing is
// faked or patched. Items do real CPU work, and event-loop turns are seen by a
// setImmediate ticker. Only the order is printed, never times, so the output
// can be compared with a stored snapshot.
//
// Items cost 0.4 ms, so a 1 ms slice fits 3 of them (starting at 0, 0.4 and
// 0.8 ms) with a 0.2 ms margin on both sides. That keeps the order stable
// across runs despite real timing noise.
const ITEM_MS = 0.4;

function busy(ms) {
	const end = performance.now() + ms;
	while (performance.now() < end);
}

function record(scenario) {
	const events = [];
	let running = true;
	const item = (job, index) => {
		events.push({ kind: 'item', job, index });
		busy(ITEM_MS);
	};
	(async () => {
		// Warm up: run the scenario once unrecorded, so V8 has compiled the code
		// and the recorded run is not slowed down by compilation.
		await scenario(() => busy(ITEM_MS));
		await new Promise(r => setTimeout(r, 5)); // let the warm-up slices end
		(function turn() {
			if (!running) return;
			events.push({ kind: 'turn' });
			setImmediate(turn);
		})();
		await scenario(item);
		events.push({ kind: 'done' });
		running = false;
		process.stdout.write(format(events));
	})();
}

// Collapses consecutive items of one job into one line, e.g. A[0..2].
function format(events) {
	const lines = [];
	for (let i = 0; i < events.length; i++) {
		const e = events[i];
		if (e.kind !== 'item') {
			lines.push(e.kind);
			continue;
		}
		let j = i;
		while (events[j + 1]?.kind === 'item' && events[j + 1].job === e.job) j++;
		lines.push(j > i ? `${e.job}[${e.index}..${events[j].index}]` : `${e.job}[${e.index}]`);
		i = j;
	}
	return lines.join('\n') + '\n';
}

module.exports = { record };
