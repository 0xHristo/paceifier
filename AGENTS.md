# AGENTS.md

Guidance for AI coding agents working in this repository.

## What this is

paceifier runs long synchronous loops in slices of about 1 ms and gives the
event loop a turn between slices. It has no dependencies and is plain CommonJS
JavaScript with hand-written type declarations.

| Path | Contents |
|---|---|
| `lib/slice.js` | `pace()`, the slice timer and the queue of waiting callers |
| `lib/methods.js` | The `…Paced` methods, all built on `pace()` |
| `index.js`, `index.d.ts` | The public exports and their types |
| `register.js`, `register.d.ts` | The opt-in methods on `Array.prototype` and `Iterator.prototype` |
| `test/` | Unit tests, execution snapshots and runtime checks |
| `bench/` | Time, stall and memory benchmarks |

## Commands

| Command | When to run it |
|---|---|
| `npm test` | After every change. Needs Node 22 or later |
| `npm run test:update` | Only after an intended change to the order of execution |
| `test/runtimes/run.sh <node\|deno\|bun>` | After changing exports, `package.json` or `register.js` |
| `npm run bench:compare` | After changing `lib/`, to compare time and stalls with `main` |

## Rules

- Keep the public API in sync. A new or changed export needs `index.js`,
  `index.d.ts` with JSDoc and an example, `register.d.ts`, the README table,
  `llms.txt` and a test.
- Assign each export on its own line in `index.js`, so ESM loaders can detect
  the named exports.
- Callbacks are synchronous and get `(item, index)`. Every method takes any
  iterable and returns a promise.
- Await the promise from `pace()` directly. `resumeNext()` in
  `lib/slice.js` relies on it to hand the rest of a slice to the next caller.
- Don't fake timers or the clock in tests. The snapshot scenarios in
  `test/scenarios/` run for real, and the snapshots contain no times.
- Snapshot files change only through `npm run test:update`, and the diff should
  be reviewed line by line.
- Support Node 22+, Deno 2.9+ and Bun 1.2+. Don't use APIs that one of them
  lacks without a fallback.
- Keep files small and focused, under about 300 lines.

## Style

- Tabs for indentation, single quotes, `'use strict'` at the top of every file.
- Require Node built-ins with the `node:` prefix.
- Start each file with a short comment on what it does, and name tests as
  sentences that describe the behaviour.
- In docs and comments, write short sentences and don't put a colon in the
  middle of one.
