'use strict';
// Puts two snapshots next to each other, lined up by event-loop iteration and
// phase. Rows that ran in the same loop and phase share a block, and the shorter
// side of a block is padded with empty rows.
const PHASES = ['timers', 'pending', 'poll', 'check', 'close'];

function rows(text) {
	return text
		.trim()
		.split('\n')
		.slice(1) // header
		.map(line => {
			const [, loop, phase, step] = line.match(/^#(\d+)\s+(\S+)\s+(.*)$/);
			return { loop: Number(loop), phase, step, line };
		});
}

function sideBySide(leftTitle, leftText, rightTitle, rightText) {
	const left = rows(leftText);
	const right = rows(rightText);
	const key = r => r.loop * 10 + PHASES.indexOf(r.phase);
	const keys = [...new Set([...left, ...right].map(key))].sort((a, b) => a - b);
	const width = Math.max(leftTitle.length, ...left.map(r => r.line.length)) + 2;
	const out = [`${leftTitle.padEnd(width)}| ${rightTitle}`, `${'loop  phase    step'.padEnd(width)}| loop  phase    step`];
	for (const k of keys) {
		const l = left.filter(r => key(r) === k);
		const r = right.filter(x => key(x) === k);
		for (let i = 0; i < Math.max(l.length, r.length); i++) {
			out.push(`${(l[i]?.line ?? '').padEnd(width)}| ${r[i]?.line ?? ''}`.trimEnd());
		}
	}
	return out.join('\n') + '\n';
}

module.exports = { sideBySide };
