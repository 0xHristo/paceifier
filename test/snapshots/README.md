# Execution snapshots

Each `.txt` file here records the order in which a scenario from
`test/scenarios/` really ran: which steps ran, in which iteration of the Node.js
event loop, and in which phase of that iteration. `test/snapshots.test.js` runs
every scenario again and fails if the order changes.

## How to read a snapshot

```
loop  phase   step
#1    timers  A: start
#1    timers  A: items 0, 1
#1    timers  A: pause before item 2
#1    timers  B: start
#1    timers  B: pause before item 0
#2    poll    io: callback
#2    check   immediate: endSlice
#2    check   immediate: resume A
#2    check   A: item 2
#2    check   microtask: resume B
#2    check   B: item 0
#2    check   B: pause before item 1
#2    check   A: done
#3    poll    io: callback
...
```

This is `handoff.txt`, with two `mapPaced` jobs, A and B, of 3 items each.

### `loop`

The event-loop iteration the step ran in. `#1` is the iteration the recording
starts in. All steps with the same number ran without the event loop getting a
turn in between, so a new number means I/O and timers had a chance to run.

### `phase`

The phase of the event loop the step ran in. In each iteration Node goes
through its phases in a fixed order. These three show up here:

| Phase | What runs there |
|---|---|
| `timers` | `setTimeout` callbacks. The recording starts in one, so the first slice of work runs here |
| `poll` | I/O callbacks, such as a finished file read or a network response |
| `check` | `setImmediate` callbacks. paceifier ends each slice here and resumes the paused jobs, so their work runs here too |

Promise continuations (microtasks) run right after the callback that triggered
them, within the same phase. That's why a job resumed by a `setImmediate`
callback shows the `check` phase.

### `step`

| Step | Meaning |
|---|---|
| `A: start` | Job A called `mapPaced` |
| `A: items 0, 1` | Job A ran items 0 and 1 back to back, without a pause in between |
| `A: item 2` | Job A ran a single item |
| `A: pause before item 2` | The slice ran out, so job A stopped and waits for its turn |
| `A: done` | The code awaiting job A continued after the job finished. It can show up a little after the job's last item, because it runs a few microtasks later |
| `io: callback` | An I/O callback ran. A chain of `fs.stat` calls runs alongside the jobs, so every iteration has one |
| `immediate: endSlice` | paceifier's `setImmediate` callback ended the slice and started a new one |
| `immediate: resume A` | That callback resumed job A, the first job in the queue |
| `microtask: resume B` | Job B resumed in the same iteration, because the job before it finished with time left in its slice |

## The scenarios

| File | What it runs |
|---|---|
| `array-map.txt` | A plain blocking `Array.map`. Everything runs in `#1`, and I/O only gets to run in `#2`, after the whole job |
| `map-paced.txt` | One `mapPaced` job. It pauses every 2 items, and each iteration has I/O, then the next slice |
| `promise-all.txt` | Three `mapPaced` jobs with `Promise.all`. Paused jobs take turns, A, B, C, B, C |
| `for-loop.txt` | The same three jobs one after another. Each starts when the previous one is done |
| `handoff.txt` | Two jobs of 3 items. A finishes halfway through a slice, and B uses the rest of it |

## How the recording works

- The scenarios run for real. Nothing is faked. Each item busy-waits for
  0.67 ms, so a 1 ms slice fits 2 items, with a 0.33 ms margin on both sides.
- `setImmediate` is wrapped only to see which callback runs. The real
  `setImmediate` still does the scheduling.
- Each scenario runs once unrecorded first, so V8 has compiled the code.
- No times are printed, so the files don't change from run to run.
- If the OS pauses the process at the wrong moment, an item can still land in
  the next slice. The test retries a mismatching scenario up to 3 times before
  it fails.

## Updating

After an intended change in behaviour, run `npm run test:update` and review the
diff of these files before committing.
