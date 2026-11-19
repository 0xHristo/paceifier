# Execution snapshots

Each `.txt` file here records the order in which a scenario from
`test/scenarios/` really ran: which steps ran, in which iteration of the Node.js
event loop, and in which phase of that iteration. `test/snapshots.test.js` runs
every scenario again and fails if the order changes.

## How to read a snapshot

This is `handoff.txt`, with two `mapPaced` jobs of 3 items each. Job A works on
`'a0'`, `'a1'` and `'a2'`, and job B on `'b0'`, `'b1'` and `'b2'`:

```
loop  phase    step
#1    timers   mapPaced(['a0', 'a1', 'a2'], work)
#1    timers   work('a0', 0), work('a1', 1)
#1    timers   await immediate(), paused before work('a2', 2)
#1    timers   mapPaced(['b0', 'b1', 'b2'], work)
#1    timers   await immediate(), paused before work('b0', 0)
#1    timers   setTimeout callback
#1    pending  net.connect 'error' event
#1    poll     fs.stat callback
#1    poll     process.nextTick callback
#1    poll     queueMicrotask callback
#1    check    endSlice()
#1    check    resumeNext() resumes work('a2', 2)
#1    check    work('a2', 2)
#1    check    resumeNext() resumes work('b0', 0) in a microtask
#1    check    work('b0', 0)
#1    check    await immediate(), paused before work('b1', 1)
#1    check    mapPaced(['a0', 'a1', 'a2'], work) resolved
#1    close    net.connect 'close' event
#2    timers   setTimeout callback
#2    pending  net.connect 'error' event
#2    poll     fs.stat callback
#2    poll     process.nextTick callback
#2    poll     queueMicrotask callback
#2    check    endSlice()
#2    check    resumeNext() resumes work('b1', 1)
#2    check    work('b1', 1), work('b2', 2)
#2    check    mapPaced(['b0', 'b1', 'b2'], work) resolved
#2    close    net.connect 'close' event
```

Each row has three columns.

### `loop`

The event-loop iteration the step ran in. `#1` is the iteration the recording
starts in. A new iteration starts each time the loop goes back to its first
phase.

### `phase`

The phase of the event loop the step ran in. Every iteration goes through six
phases in a fixed order:

| # | Phase | What runs there | Shown as |
|---|---|---|---|
| 1 | timers | `setTimeout` and `setInterval` callbacks that are due | `timers` |
| 2 | pending callbacks | I/O callbacks that libuv deferred from the previous iteration, for example a failed Unix-socket connect | `pending` |
| 3 | idle, prepare | only libuv's own code, never JavaScript | never shown |
| 4 | poll | I/O callbacks, such as a finished file read or a network response | `poll` |
| 5 | check | `setImmediate` callbacks. paceifier ends each slice here and resumes the paused jobs | `check` |
| 6 | close callbacks | `close` events of sockets and other handles | `close` |

Between any two callbacks, in every phase, Node also empties two queues:
first the `process.nextTick` callbacks, then the microtasks (promise
continuations and `queueMicrotask`). They run within the phase of the callback
that queued them. That's why a job resumed by paceifier's `setImmediate`
callback shows the `check` phase.

To make every phase visible, the recorder runs real background work alongside
the jobs, which puts one callback into each phase in every iteration:

| Step | Phase | Source |
|---|---|---|
| `setTimeout callback` | timers | a chain of `setTimeout(0)` calls |
| `net.connect 'error' event` | pending | `net.connect` to a Unix socket that doesn't exist. libuv reports the error in the next pending phase |
| `fs.stat callback` | poll | a chain of `fs.stat` calls |
| `process.nextTick callback` | poll | a `process.nextTick` queued by the `fs.stat` callback |
| `queueMicrotask callback` | poll | a `queueMicrotask` queued by the `fs.stat` callback. It runs after the `nextTick` one |
| `net.connect 'close' event` | close | the `close` event of the failed socket, which also starts the next connect |

### `step`

The code that ran, written as the call with its arguments. Each job's items are
strings that name the job, `'a0'`, `'a1'` for job A and `'b0'`, `'b1'` for job B,
so every row shows which job it belongs to.

| Step | Meaning |
|---|---|
| `mapPaced(['a0', 'a1', 'a2'], work)` | Job A called `mapPaced` with its items and the callback `work` |
| `work('a0', 0), work('a1', 1)` | `mapPaced` called `work(value, index)` for `'a0'` and `'a1'`, back to back without a pause |
| `await immediate(), paused before work('a2', 2)` | The slice ran out. paceifier's `immediate()` returned a promise, `mapPaced` awaits it, and `work('a2', 2)` is the next call once job A resumes |
| `endSlice()` | paceifier's `setImmediate` callback ended the slice and started a new one |
| `resumeNext() resumes work('a2', 2)` | `endSlice()` called `resumeNext()`, which resumed the first paused job. Its next call follows |
| `resumeNext() resumes work('b0', 0) in a microtask` | A job resumed in the same slice, because the job before it finished with time left |
| `mapPaced(['a0', 'a1', 'a2'], work) resolved` | The code awaiting job A continued after the job finished. It can show up a little after the job's last call, because it runs a few microtasks later |
| `['a0', 'a1'].map(work)`, `… returned` | A plain blocking `Array.map`, which calls `work` for every item without pausing |
| `Promise.all(['a0', 'a1'].map(async work))` | Every item wrapped in its own promise. The async callbacks run synchronously, and the promises only resolve afterwards, in microtasks |
| `forEachPaced(['a0', 'a1'], work)` | Job A called `forEachPaced`, which pauses the same way as `mapPaced` but returns no results |
| `Promise.all(await mapPaced(['a0', 'a1'], async work))` | `mapPaced` calls the async callback for each item in paced slices and returns the array of promises, which `Promise.all` waits for. `mapPaced` doesn't wait for each promise, so only the synchronous part of the callback is paced |

## The scenarios

| File | What it runs |
|---|---|
| `array-map.txt` | A plain blocking `Array.map`. The whole job runs in the timers phase of `#1`, and the other phases only get to run after it |
| `map-paced.txt` | One `mapPaced` job. It runs 2 items per slice, and between slices the loop goes through all its phases |
| `promise-all.txt` | Three `mapPaced` jobs with `Promise.all`. Paused jobs take turns, A, B, C, B, C |
| `promise-all-array-map.txt` | The same three jobs with `Promise.all`, but each uses a plain `Array.map`. They run one after another, all in `#1`, because `Promise.all` doesn't make synchronous work concurrent |
| `promise-all-side-by-side.txt` | The two files above next to each other, lined up by loop and phase. It's built from them, not recorded |
| `promise-all-async-map.txt` | The same three jobs with `Promise.all`, where each job also wraps every item in a promise, `Promise.all(values.map(async work))`. The async callbacks still run synchronously, so everything runs in `#1` before anything else |
| `promise-all-for-each-paced.txt` | The same three jobs with `forEachPaced`. Same slices and turns as with `mapPaced` |
| `promise-all-async-map-side-by-side.txt` | The two files above next to each other, built from them |
| `promise-all-async-map-paced.txt` | Again a promise per item, but created by `mapPaced`, `Promise.all(await mapPaced(values, async work))`. The synchronous part of each async callback runs in paced slices, and `Promise.all` then waits for the promises |
| `map-paced-vs-promise-all-side-by-side.txt` | `promise-all.txt` next to `promise-all-async-map-paced.txt`, built from them. Every row matches apart from the call text, and a test checks that they stay the same |
| `for-loop.txt` | The same three `mapPaced` jobs one after another. Each starts when the previous one is done |
| `handoff.txt` | Two jobs of 3 items. A finishes halfway through a slice, and B uses the rest of it |

## How the recording works

- The scenarios run for real. Nothing is faked. Each item busy-waits for
  0.67 ms, so a 1 ms slice fits 2 items, with a 0.33 ms margin on both sides.
- `setImmediate` is wrapped only to see which callback runs. The real
  `setImmediate` still does the scheduling.
- Each scenario runs once unrecorded first, so V8 has compiled the code.
- The recording starts in a `setTimeout` callback, so the first slice runs in
  the timers phase. It stops at the close phase of the iteration the jobs
  finished in.
- No times are printed, so the files don't change from run to run.
- If the OS pauses the process at the wrong moment, an item can still land in
  the next slice. The test retries a mismatching scenario up to 3 times before
  it fails.

## Updating

After an intended change in behaviour, run `npm run test:update` and review the
diff of these files before committing.
