# paceifier

Paced versions of the standard collection methods. Long sequential work runs in
slices of about 1 ms, and between slices the Node.js event loop gets a turn to
handle I/O and timers. A long job then holds up other work for about a
millisecond at a time instead of for its whole duration.

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
const { immediate } = require('paceifier');

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

- Work runs in slices of about 1 ms. The first call to `immediate()` starts a
  slice, notes the time and schedules a callback with `setImmediate` that will
  end the slice.
- Each later call checks the clock. While the slice has time left, it returns
  `undefined` and the caller keeps going. Once 1 ms has passed, it returns a
  promise. The caller awaits it, its synchronous code stops, and the event loop
  is free to run I/O callbacks and timers.
- That callback runs on the next event-loop turn, which can only happen after
  the paced code has stopped. It starts a new slice and resumes the first
  waiting caller.
- Callers that run out of time queue up and resume in order, so concurrent
  callers take turns. If a resumed caller finishes before its slice is used up,
  the next waiting caller resumes in the same turn.
- No promise is created while the slice has time left, so an item that doesn't
  pause costs one `performance.now()` call.
- If a test framework replaces `setImmediate` with a fake (Jest or Sinon fake
  timers), paceifier still uses the real one from `node:timers`, so paced code
  keeps running in those tests.

## Performance

Measured with `npm run bench` (Node 26.3, median of 7 runs). Each row runs the
same callback over an array, once with a blocking `Array.map` and once with
`mapPaced`. The callbacks go from a single multiplication to a loop that takes
longer than half a slice, and the second column shows how long one call takes.

**Time.** Pacing adds about 75 ns per item, mostly one `performance.now()` call,
plus a few microseconds per pause.

| Callback | Time per item | Items | `Array.map` | `mapPaced` | Slower |
|---|---|---|---|---|---|
| `x * 2` | 11 ns | 1,000,000 | 11.4 ms | 82.8 ms | 627% |
| 100-step loop | 0.4 µs | 500,000 | 204.3 ms | 242.7 ms | 19% |
| 1k-step loop | 4.2 µs | 100,000 | 421.3 ms | 441.1 ms | 5% |
| 10k-step loop | 42 µs | 10,000 | 421.0 ms | 428.4 ms | 2% |
| 150k-step loop | 0.59 ms | 500 | 296.6 ms | 302.6 ms | 2% |
| **total** | | | 1354.6 ms | 1497.7 ms | 11% |

**Stalls.** How long the event loop had to wait for a turn while the job ran.

| Callback | Time per item | `Array.map` | `mapPaced` p50 | p99 | max |
|---|---|---|---|---|---|
| `x * 2` | 11 ns | 11.1 ms | 1.02 ms | 6.23 ms | 6.23 ms |
| 100-step loop | 0.4 µs | 202.4 ms | 1.02 ms | 1.21 ms | 1.57 ms |
| 1k-step loop | 4.2 µs | 419.2 ms | 1.02 ms | 1.08 ms | 1.86 ms |
| 10k-step loop | 42 µs | 420.6 ms | 1.03 ms | 1.08 ms | 1.35 ms |
| 150k-step loop | 0.59 ms | 298.0 ms | 1.20 ms | 1.42 ms | 1.63 ms |

The time is checked before each item, so a slice can run over 1 ms by up to one
item. With 0.59 ms items, the worst stall is therefore about 1.6 ms. Rare longer
stalls, like the 6 ms with `x * 2`, come from garbage collection.

**Memory.** For 1,000,000 items, the result of `mapPaced` keeps 9.9 MB against
7.6 MB for `Array.map`, because it grows its result array with `push` instead of
allocating it once. Smaller jobs show no real difference, and neither causes
more than one garbage collection.

When each item does real work, pacing costs a few percent, and in exchange the
event loop gets a turn about every millisecond instead of being blocked for the
whole job. For callbacks as cheap as `x * 2`, the clock read dominates, so a
plain loop is faster there.

## Development

| Command | What it does |
|---|---|
| `npm test` | Runs the tests, including the execution snapshots |
| `npm run test:update` | Runs the tests and rewrites the snapshots in `test/snapshots/` |
| `npm run bench` | Benchmarks time, stalls and memory of `mapPaced` against a blocking `Array.map` |
| `npm run bench:compare [-- <ref>]` | Compares time and p99 stall of the working tree with a git ref, `main` by default |

Each script in `test/scenarios/` runs paced work for real and prints every step
in the order it ran, without times. Each line starts with the event-loop
iteration it ran in (`#1` is the iteration the recording starts in), then says
what ran it:

| Prefix | Meaning |
|---|---|
| `io:` | an I/O callback; a chain of `fs.stat` calls runs alongside the jobs |
| `immediate:` | a `setImmediate` callback, such as the one that ends a slice and resumes the next job |
| `microtask:` | a job resumed in the same turn, because the job before it finished early |
| `A:`, `B:`, … | the job's own work: start, items, pauses and completion. Items that ran back to back share a line, e.g. `A: items 0, 1` |

`test/snapshots.test.js` runs every scenario in its own process and compares the
output with `test/snapshots/<name>.txt`. For example, three `mapPaced` jobs of 4
items each, run with `Promise.all`:

```
#1 A: start
#1 A: items 0, 1
#1 A: pause before item 2
#1 B: start
#1 B: pause before item 0
#1 C: start
#1 C: pause before item 0
#2 io: callback
#2 immediate: endSlice
#2 immediate: resume A
#2 A: items 2, 3
#2 A: done
#3 io: callback
#3 immediate: endSlice
#3 immediate: resume B
#3 B: items 0, 1
#3 B: pause before item 2
#4 io: callback
#4 immediate: endSlice
#4 immediate: resume C
#4 C: items 0, 1
#4 C: pause before item 2
#5 io: callback
#5 immediate: endSlice
#5 immediate: resume B
#5 B: items 2, 3
#5 B: done
#6 io: callback
#6 immediate: endSlice
#6 immediate: resume C
#6 C: items 2, 3
#6 C: done
#7 io: callback
#7 immediate: endSlice
```

Items cost 0.67 ms, so a 1 ms slice fits 2 of them, with enough margin that real
timing noise doesn't change the order. If the OS pauses the process at the wrong
moment, an item can still land in the next slice, so the test retries a
mismatching scenario up to 3 times before it fails. A job's `done` line can appear after
other work, because it's printed by the code awaiting the job, which runs a few
microtasks later.

## License

Apache-2.0
