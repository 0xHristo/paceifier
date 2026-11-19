# Execution snapshots

Each `.txt` file here records the order in which a scenario from
`test/scenarios/` really ran: which steps ran, in which iteration of the Node.js
event loop, and in which phase of that iteration. `test/snapshots.test.js` runs
every scenario again and fails if the order changes.

## How to read a snapshot

This is `handoff.txt`, with two `mapPaced` jobs, A and B, of 3 items each:

```
loop  phase    step
#1    timers   A: start
#1    timers   A: items 0, 1
#1    timers   A: pause before item 2
#1    timers   B: start
#1    timers   B: pause before item 0
#1    timers   timeout: callback
#1    pending  socket: connect error
#1    poll     io: callback
#1    poll     nextTick: callback
#1    poll     microtask: callback
#1    check    immediate: endSlice
#1    check    immediate: resume A
#1    check    A: item 2
#1    check    microtask: resume B
#1    check    B: item 0
#1    check    B: pause before item 1
#1    check    A: done
#1    close    socket: closed
#2    timers   timeout: callback
#2    pending  socket: connect error
#2    poll     io: callback
#2    poll     nextTick: callback
#2    poll     microtask: callback
#2    check    immediate: endSlice
#2    check    immediate: resume B
#2    check    B: items 1, 2
#2    check    B: done
#2    close    socket: closed
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
| `timeout: callback` | timers | a chain of `setTimeout(0)` calls |
| `socket: connect error` | pending | `net.connect` to a Unix socket that doesn't exist. libuv reports the error in the next pending phase |
| `io: callback` | poll | a chain of `fs.stat` calls |
| `nextTick: callback` | poll | a `process.nextTick` queued by the `fs.stat` callback |
| `microtask: callback` | poll | a `queueMicrotask` queued by the `fs.stat` callback. It runs after the `nextTick` one |
| `socket: closed` | close | the `close` event of the failed socket, which also starts the next connect |

### `step`

The steps of the jobs and of paceifier:

| Step | Meaning |
|---|---|
| `A: start` | Job A called `mapPaced` |
| `A: items 0, 1` | Job A ran items 0 and 1 back to back, without a pause in between |
| `A: item 2` | Job A ran a single item |
| `A: pause before item 2` | The slice ran out, so job A stopped and waits for its turn |
| `A: done` | The code awaiting job A continued after the job finished. It can show up a little after the job's last item, because it runs a few microtasks later |
| `immediate: endSlice` | paceifier's `setImmediate` callback ended the slice and started a new one |
| `immediate: resume A` | That callback resumed job A, the first job in the queue |
| `microtask: resume B` | Job B resumed in the same phase, because the job before it finished with time left in its slice |

## The scenarios

| File | What it runs |
|---|---|
| `array-map.txt` | A plain blocking `Array.map`. The whole job runs in the timers phase of `#1`, and the other phases only get to run after it |
| `map-paced.txt` | One `mapPaced` job. It runs 2 items per slice, and between slices the loop goes through all its phases |
| `promise-all.txt` | Three `mapPaced` jobs with `Promise.all`. Paused jobs take turns, A, B, C, B, C |
| `for-loop.txt` | The same three jobs one after another. Each starts when the previous one is done |
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
