# paceifier

Paced versions of the standard collection methods. Long sequential work runs in
1 ms slices, so it never blocks the Node.js event loop.

```js
const { mapPaced, forEachPaced } = require('paceifier');

const lines = await mapPaced(bigArray, (item, index) => format(item));
await forEachPaced(map.values(), entry => work(entry));
```

Or opt in to methods on arrays and iterators:

```js
require('paceifier/register');

const lines = await bigArray.mapPaced(item => format(item));
await map.values().forEachPaced(entry => work(entry));
```

## Methods

Every method takes any iterable (arrays, `Map`/`Set` iterators, generators) and a
synchronous `fn(item, index)`, and returns a promise.

| Paced | Standard | Resolves to |
|---|---|---|
| `forEachPaced(items, fn)` | `forEach` | `undefined` |
| `mapPaced(items, fn)` | `map` | a new array |
| `filterPaced(items, fn)` | `filter` | a new array |
| `flatMapPaced(items, fn)` | `flatMap` | a new array, flattened one level |
| `reducePaced(items, fn, init?)` | `reduce` | the accumulated value |
| `findPaced(items, fn)` | `find` | the first match or `undefined` |
| `findIndexPaced(items, fn)` | `findIndex` | its index or `-1` |
| `somePaced(items, fn)` | `some` | a boolean, stops at the first match |
| `everyPaced(items, fn)` | `every` | a boolean, stops at the first miss |

If `fn` throws, the promise rejects.

`require('paceifier/register')` adds the same methods (without the `items`
argument) to `Array.prototype` and `Iterator.prototype` (Node 22+). They are
non-enumerable and only added where they don't already exist.

`immediate()` is the low-level check. It returns `undefined` while the slice has
time left, or a promise to await before doing more work.

```js
for (const item of items) {
	const pause = immediate();
	if (pause) await pause;
	work(item);
}
```

Await the promise from `immediate()` directly, as above. Wrapping it in another
async function delays the caller by extra microtasks, and the slice can then
overrun.

## How it works

- A slice starts on the first call and schedules `endSlice` with `setImmediate`.
- `endSlice` can only run once the caller stops running synchronously, so a slice
  ends exactly when the event loop gets a turn. Busy time is never mistaken for
  idle time.
- Callers that run out of time queue up and resume in order, so concurrent
  callers take turns. If a resumed caller finishes before its slice is used up,
  the next waiting caller resumes in the same turn.
- No promise is created while the slice has time left, so items that don't pause
  cost one `performance.now()` call.
- Fake `setImmediate` implementations (Jest/Sinon timers) are skipped, so tests
  with fake timers don't hang.

## Performance

Measured with `npm run bench` (Node 26.3, median of 7 runs), comparing a
blocking `Array.map` with `mapPaced` doing the same work.

**Time.** Pacing costs about 75 ns per item, mostly one `performance.now()` call,
plus a few microseconds per pause.

| Work per item | Items | `Array.map` | `mapPaced` | Slower |
|---|---|---|---|---|
| trivial (`x * 2`) | 1,000,000 | 10.0 ms | 84.0 ms | 744% |
| ~0.2 µs | 500,000 | 202.1 ms | 250.7 ms | 24% |
| ~2 µs | 100,000 | 419.2 ms | 436.5 ms | 4% |
| ~40 µs | 10,000 | 418.9 ms | 432.0 ms | 3% |
| ~0.6 ms | 500 | 301.9 ms | 303.2 ms | 0% |

**Stalls.** The longest time the event loop waited for a turn while the job ran.

| Work per item | `Array.map` | `mapPaced` p50 | p99 | max |
|---|---|---|---|---|
| trivial (`x * 2`) | 10.0 ms | 1.01 ms | 5.07 ms | 5.07 ms |
| ~0.2 µs | 201.0 ms | 1.02 ms | 1.05 ms | 1.23 ms |
| ~2 µs | 419.2 ms | 1.02 ms | 1.05 ms | 1.56 ms |
| ~40 µs | 418.2 ms | 1.03 ms | 1.11 ms | 1.78 ms |
| ~0.6 ms | 302.3 ms | 1.20 ms | 1.36 ms | 1.61 ms |

The time is checked before each item, so a slice can run over 1 ms by up to one
item. With 0.6 ms items, the worst stall is therefore about 1.6 ms. Rare longer
stalls, like the 5 ms in the trivial case, come from garbage collection.

**Memory.** For 1,000,000 items, the result of `mapPaced` keeps 9.9 MB against
7.6 MB for `Array.map`, because it grows its result array with `push` instead of
allocating it once. Smaller jobs show no real difference, and neither causes
more than one garbage collection.

For real work per item the cost is a few percent, and in exchange the event loop
gets a turn about every millisecond instead of being blocked for the whole job.
For trivial callbacks the clock read dominates, so a plain loop is faster there.

## Development

| Command | What it does |
|---|---|
| `npm test` | Runs the tests, including the execution snapshots |
| `npm run test:update` | Runs the tests and rewrites the snapshots in `test/snapshots/` |
| `npm run bench` | Benchmarks time, stalls and memory of `mapPaced` against a blocking `Array.map` |
| `npm run bench:compare [-- <ref>]` | Compares time and p99 stall of the working tree with a git ref, `main` by default |

Each script in `test/scenarios/` runs paced work for real and prints the order of
execution, without times. `test/snapshots.test.js` runs every scenario in its own
process and compares the output with `test/snapshots/<name>.txt`. For example,
three `mapPaced` jobs run with `Promise.all`:

```
turn
A[0..2]
turn
A[3..4]
B[0]
turn
C[0..2]
turn
B[1..3]
turn
C[3..4]
B[4]
done
```

Each `turn` line is a point where the event loop got control back, so I/O and
timers could run. Items cost 0.4 ms, so a 1 ms slice fits 3 of them. Because the
timing is real, a rare GC pause can shift an item into the next slice and fail a
snapshot. Rerun the test if that happens.

## License

Apache-2.0
