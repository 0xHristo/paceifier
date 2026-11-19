# paceifier

Paced versions of the standard collection methods. Long sequential work runs in
slices of about 1 ms, and between slices the Node.js event loop gets a turn to
handle I/O and timers. A long job then holds up other work for about a
millisecond at a time instead of for its whole duration.

In short, paceifier caps how long synchronous code can stall the event loop.
See [Usage](#usage) for examples, [How it works](#how-it-works) for the
details and the [FAQ](#faq) for common questions.

## Why

Node.js runs JavaScript on a single thread. CPU-heavy work, like going through
the rows of a large CSV or XML file or converting a big object, keeps that
thread busy until it finishes. Meanwhile the process can't answer requests,
read sockets or run timers, so every other task on the service waits.

paceifier splits that one long block into slices. You run the work through a
`…Paced` method, or call `pace()` in your own loop and await it when it
returns a promise. Each slice runs for about 1 ms, then the event loop gets a
full turn to handle everything else that is waiting.

The trade-off is that the job itself takes longer. How much longer depends on
how much work each item does. With very cheap items, like `x * 2`, the job runs
about 7 times slower. With items that take a few microseconds or more, it is
only 2 to 5% slower (see [Performance](#performance)). In exchange, the service
stays responsive and can keep handling other work while the job runs.

### When to use it

- Long loops on a server, where one job must not delay other requests.
- Processing many items, such as CSV or XML rows, records from a database, or
  entries of a large `Map`.
- Building or transforming large objects piece by piece.

### When not to use it

- Short jobs that finish within a few milliseconds. They don't block for long,
  and pacing only adds overhead.
- Very cheap items in a hot loop, where the clock check costs more than the
  work itself.
- One call that can't be split, like a single `JSON.parse` of a huge string.
  paceifier can only pause between items, not inside a call.
- Work that needs the full CPU and must finish as fast as possible. Run it in a
  [worker thread](https://nodejs.org/api/worker_threads.html) instead.

## Usage

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

`pace()` is the low-level check. It returns `undefined` while the slice has
time left, or a promise to await before doing more work.

```js
const { pace } = require('paceifier');

for (const item of items) {
	const pause = pace();
	if (pause) await pause;
	work(item);
}
```

Await the promise from `pace()` directly, as above. Wrapping it in another
async function delays the caller by extra microtasks, and the slice can then
overrun.

## Runtimes

| Runtime | Supported | Tested in CI |
|---|---|---|
| Node.js | 22 and later | 22, 24, 26 |
| Deno | 2.9 and later | 2.9 LTS, latest 2.x |
| Bun | 1.2 and later | 1.2.0, latest |

Node 22 and Deno 2.9 are the oldest LTS releases that are still supported. Bun
has no LTS. Both `require` and `import` work, including `paceifier/register`.

On older runtimes (Node 18 and 20, Bun 1.0 and 1.1) everything works except the
`register` methods on iterators, because those runtimes have no
`Iterator.prototype`. `register` then skips them.

## How it works

- Work runs in slices of about 1 ms. The first call to `pace()` starts a
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

Measured with `npm run bench` (Node 26.3). Time and stalls are the median of 7
runs each. Each row runs the same callback over an array, once with a blocking
`Array.map` and once with `mapPaced`. The callbacks go from a single
multiplication to a loop that takes longer than half a slice, and the second
column shows how long one call takes.

**Time.** Pacing adds about 75 ns per item, mostly one `performance.now()` call,
plus a few microseconds per pause.

| Callback | Time per item | Items | `Array.map` | `mapPaced` | Slower |
|---|---|---|---|---|---|
| `x * 2` | 11 ns | 1,000,000 | 11.0 ms | 82.6 ms | 649% |
| 100-step loop | 0.4 µs | 500,000 | 206.7 ms | 248.4 ms | 20% |
| 1k-step loop | 4.2 µs | 100,000 | 422.3 ms | 438.3 ms | 4% |
| 10k-step loop | 42 µs | 10,000 | 418.7 ms | 427.5 ms | 2% |
| 150k-step loop | 0.59 ms | 500 | 296.8 ms | 308.6 ms | 4% |
| **all five** | | | 1355.5 ms | 1505.4 ms | 11% |

The last row adds up the five runs. Its percentage depends on which callbacks the
benchmark happens to include, so read the rows above it for a real workload.

**Stalls.** How long the event loop had to wait for a turn while the job ran.
`Array.map` never gives the loop a turn, so its whole run is one stall.

| Callback | Time per item | `Array.map` | `mapPaced` p50 | p99 | max |
|---|---|---|---|---|---|
| `x * 2` | 11 ns | 10.0 ms | 1.02 ms | 6.02 ms | 6.02 ms |
| 100-step loop | 0.4 µs | 209.9 ms | 1.02 ms | 1.37 ms | 1.74 ms |
| 1k-step loop | 4.2 µs | 421.8 ms | 1.02 ms | 1.06 ms | 1.65 ms |
| 10k-step loop | 42 µs | 419.2 ms | 1.03 ms | 1.08 ms | 1.50 ms |
| 150k-step loop | 0.59 ms | 300.3 ms | 1.23 ms | 1.50 ms | 1.60 ms |

The time is checked before each item, so a slice can run over 1 ms by up to one
item. With 0.59 ms items, the worst stall is therefore about 1.6 ms. The 6 ms with
`x * 2` shows up in every run, not only the first. It comes from garbage
collection while the 1,000,000-item result array fills up, and the same job
without a result array stays under about 2 ms.

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
| `test/runtimes/run.sh <node\|deno\|bun>` | Packs the package, installs it in a temporary app and checks it with that runtime |
| `npm run bench:compare [-- <ref>]` | Compares time and p99 stall of the working tree with a git ref, `main` by default |

Each script in `test/scenarios/` runs paced work for real and records every step
in the order it ran. Each row shows the event-loop iteration, the phase of the
loop and what ran. Real background work puts a callback into every phase that
can run JavaScript, so each iteration shows the whole loop.
`test/snapshots.test.js` runs every scenario in its own process and compares the
result with `test/snapshots/<name>.txt`. For example, three `mapPaced` jobs
of 4 items each, run with `Promise.all`:

```
loop  phase    step
#1    timers   mapPaced(['a0', 'a1', 'a2', 'a3'], work)
#1    timers   work('a0', 0), work('a1', 1)
#1    timers   await pace(), paused before work('a2', 2)
#1    timers   mapPaced(['b0', 'b1', 'b2', 'b3'], work)
#1    timers   await pace(), paused before work('b0', 0)
#1    timers   mapPaced(['c0', 'c1', 'c2', 'c3'], work)
#1    timers   await pace(), paused before work('c0', 0)
#1    timers   setTimeout callback
#1    pending  net.connect 'error' event
#1    poll     fs.stat callback
#1    poll     process.nextTick callback
#1    poll     queueMicrotask callback
#1    check    endSlice()
#1    check    resumeNext() resumes work('a2', 2)
#1    check    work('a2', 2), work('a3', 3)
#1    check    mapPaced(['a0', 'a1', 'a2', 'a3'], work) resolved
#1    close    net.connect 'close' event
#2    timers   setTimeout callback
#2    pending  net.connect 'error' event
#2    poll     fs.stat callback
#2    poll     process.nextTick callback
#2    poll     queueMicrotask callback
#2    check    endSlice()
#2    check    resumeNext() resumes work('b0', 0)
#2    check    work('b0', 0), work('b1', 1)
#2    check    await pace(), paused before work('b2', 2)
#2    close    net.connect 'close' event
#3    timers   setTimeout callback
#3    pending  net.connect 'error' event
#3    poll     fs.stat callback
#3    poll     process.nextTick callback
#3    poll     queueMicrotask callback
#3    check    endSlice()
#3    check    resumeNext() resumes work('c0', 0)
#3    check    work('c0', 0), work('c1', 1)
#3    check    await pace(), paused before work('c2', 2)
#3    close    net.connect 'close' event
#4    timers   setTimeout callback
#4    pending  net.connect 'error' event
#4    poll     fs.stat callback
#4    poll     process.nextTick callback
#4    poll     queueMicrotask callback
#4    check    endSlice()
#4    check    resumeNext() resumes work('b2', 2)
#4    check    work('b2', 2), work('b3', 3)
#4    check    mapPaced(['b0', 'b1', 'b2', 'b3'], work) resolved
#4    close    net.connect 'close' event
#5    timers   setTimeout callback
#5    pending  net.connect 'error' event
#5    poll     fs.stat callback
#5    poll     process.nextTick callback
#5    poll     queueMicrotask callback
#5    check    endSlice()
#5    check    resumeNext() resumes work('c2', 2)
#5    check    work('c2', 2), work('c3', 3)
#5    check    mapPaced(['c0', 'c1', 'c2', 'c3'], work) resolved
#5    close    net.connect 'close' event
```

[test/snapshots/README.md](test/snapshots/README.md) explains every column and
step, and
[test/snapshots/promise-all-side-by-side.txt](test/snapshots/promise-all-side-by-side.txt)
shows the same three jobs with a plain `Array.map` next to `mapPaced`.
[test/snapshots/promise-all-async-map-side-by-side.txt](test/snapshots/promise-all-async-map-side-by-side.txt)
shows that wrapping every item in a promise doesn't help either, next to
`forEachPaced`.
[test/snapshots/map-paced-vs-promise-all-side-by-side.txt](test/snapshots/map-paced-vs-promise-all-side-by-side.txt)
shows that `Promise.all(await mapPaced(values, async work))` runs in exactly the
same order as `mapPaced(values, work)`.

## FAQ

### How do I stop a CPU-heavy loop from blocking other requests in Express or Fastify?

Run the loop through a paced method and await it in the route handler. Other
requests get a turn about every millisecond while it runs.

```js
app.get('/report', async (req, res) => {
	const rows = await loadRows();
	const lines = await mapPaced(rows, row => format(row));
	res.send(lines.join('\n'));
});
```

### How do I yield to the event loop inside a loop?

Call `pace()` before each item and await the promise when it returns one. It
only pauses once the current slice of about 1 ms is used up, so a short loop
never pauses at all.

### How is this different from chunking with `setImmediate`?

Chunking by a fixed number of items pauses too often when items are cheap and
too rarely when they are slow. paceifier pauses by time instead, so every slice
lasts about 1 ms whatever the items cost. Concurrent jobs also take turns
instead of all running in the same turn.

### Why is the event loop lag of my service high during a job?

A synchronous loop holds the thread until it ends, so the lag is as long as the
job. With paceifier it stays around 1 to 2 ms, as the
[stalls table](#performance) shows.

### Should I use `worker_threads` instead?

Use a worker thread when the job must finish as fast as possible, or when it is
one call that can't be split. Use paceifier when the work is a loop over many
items and you want to keep it on the main thread without copying data to a
worker.

### Does it work with Deno, Bun and TypeScript?

Yes. See [Runtimes](#runtimes). Types ship with the package, and the paced
methods keep the types of their callbacks, including type guards in
`filterPaced` and `findPaced`.

## Background

paceifier started from a proposal to stop metric export in prom-client from
blocking the event loop during a scrape.

- [prometheus/client_js#877](https://github.com/prometheus/client_js/issues/877)
  is the original issue, which proposes yielding the event loop during metric
  export.
- [prometheus/client_js#878](https://github.com/prometheus/client_js/pull/878)
  is the pull request that implements it.
- [The review comment about 64 histograms](https://github.com/prometheus/client_js/pull/878#discussion_r4606381195)
  asks what happens when the export itself takes about a millisecond. That
  question led to the slice design here. The time is measured from the start
  of each slice, so long work keeps pausing every 1 ms no matter how much of it
  there is.

## License

Apache-2.0
