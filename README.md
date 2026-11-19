# paced

Paced versions of the standard collection methods. Long sequential work runs in
1 ms slices, so it never blocks the Node.js event loop.

```js
const { mapPaced, forEachPaced } = require('paced');

const lines = await mapPaced(bigArray, (item, index) => format(item));
await forEachPaced(map.values(), entry => work(entry));
```

Or opt in to methods on arrays and iterators:

```js
require('paced/register');

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

`require('paced/register')` adds the same methods (without the `items`
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

## How it works

- A slice starts on the first call and schedules `endSlice` with `setImmediate`.
- `endSlice` can only run once the caller stops running synchronously, so a slice
  ends exactly when the event loop gets a turn. Busy time is never mistaken for
  idle time.
- Callers that run out of time queue up. Each loop turn resumes one of them in
  order, so concurrent callers take turns.
- No promise is created while the slice has time left, so items that don't pause
  cost one `performance.now()` call.
- Fake `setImmediate` implementations (Jest/Sinon timers) are skipped, so tests
  with fake timers don't hang.

## License

Apache-2.0
