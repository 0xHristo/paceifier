// Runtime check for Node, Deno and Bun. Run it from a folder where the packed
// paceifier is installed (see .github/workflows/test.yml). It exits with 1 if a
// check fails.
const p = require('paceifier');
require('paceifier/register');

const busy = ms => {
	const end = performance.now() + ms;
	while (performance.now() < end);
};

(async () => {
	const results = [];
	const check = (name, ok) => results.push({ name, ok });

	check('mapPaced', JSON.stringify(await p.mapPaced([1, 2, 3], x => x * 2)) === '[2,4,6]');
	check('filterPaced', JSON.stringify(await p.filterPaced([1, 2, 3, 4], x => x % 2 === 0)) === '[2,4]');
	check('reducePaced', (await p.reducePaced([1, 2, 3], (a, x) => a + x)) === 6);
	check('findIndexPaced', (await p.findIndexPaced([5, 6, 7], x => x === 7)) === 2);
	check('everyPaced on empty input', (await p.everyPaced([], () => false)) === true);
	check('Map iterator', JSON.stringify(await p.mapPaced(new Map([[1, 'a']]).values(), x => x)) === '["a"]');

	let turns = 0;
	let done = false;
	(async () => {
		while (!done) {
			await new Promise(resolve => setImmediate(resolve));
			turns++;
		}
	})();
	await p.forEachPaced(Array.from({ length: 50 }), () => busy(0.2));
	done = true;
	check('pauses during long work', turns >= 5);

	const order = [];
	await Promise.all(['a', 'b'].map(name =>
		p.forEachPaced(Array.from({ length: 20 }), () => {
			busy(0.3);
			order.push(name);
		})));
	check('concurrent callers take turns', order.filter((x, i) => i && x !== order[i - 1]).length > 1);

	check('register adds array methods', JSON.stringify(await [1, 2].mapPaced(x => x + 1)) === '[2,3]');
	// Iterator.prototype exists from Node 22 and Bun 1.2. Older runtimes skip it.
	if (globalThis.Iterator) {
		check('register adds iterator methods',
			JSON.stringify(await new Map([[1, 'x']]).values().mapPaced(x => x)) === '["x"]');
	}

	for (const { name, ok } of results) console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
	if (results.some(r => !r.ok)) process.exit(1);
})();
