/** A synchronous callback that gets each item and its index, like `Array.prototype.map`. */
type Fn<T, R> = (item: T, index: number) => R;

/**
 * Checks whether the current slice of about 1 ms has time left. Returns
 * `undefined` while it does, so the caller keeps going. Otherwise returns a
 * promise that resolves once the event loop has had a turn. Await it directly,
 * not through another async function.
 *
 * @example
 * for (const item of items) {
 * 	const pause = immediate();
 * 	if (pause) await pause;
 * 	work(item);
 * }
 */
export function immediate(): Promise<void> | undefined;

/**
 * Calls `fn` for every item, pausing for an event-loop turn about every 1 ms.
 * Like `forEach`. Rejects if `fn` throws.
 *
 * @example
 * await forEachPaced(map.values(), entry => work(entry));
 */
export function forEachPaced<T>(items: Iterable<T>, fn: Fn<T, void>): Promise<void>;

/**
 * Resolves to a new array of the results of `fn`, pausing for an event-loop
 * turn about every 1 ms. Like `map`. Rejects if `fn` throws.
 *
 * @example
 * const lines = await mapPaced(rows, row => format(row));
 */
export function mapPaced<T, U>(items: Iterable<T>, fn: Fn<T, U>): Promise<U[]>;

/**
 * Resolves to a new array of the items `fn` accepts, pausing for an event-loop
 * turn about every 1 ms. Like `filter`. Rejects if `fn` throws.
 *
 * @example
 * const active = await filterPaced(users, user => user.active);
 */
export function filterPaced<T, S extends T>(items: Iterable<T>, fn: (item: T, index: number) => item is S): Promise<S[]>;
export function filterPaced<T>(items: Iterable<T>, fn: Fn<T, unknown>): Promise<T[]>;

/**
 * Resolves to a new array of the results of `fn`, flattened one level, pausing
 * for an event-loop turn about every 1 ms. Like `flatMap`. Rejects if `fn` throws.
 *
 * @example
 * const words = await flatMapPaced(lines, line => line.split(' '));
 */
export function flatMapPaced<T, U>(items: Iterable<T>, fn: Fn<T, U | readonly U[]>): Promise<U[]>;

/**
 * Resolves to the value accumulated by `fn`, pausing for an event-loop turn
 * about every 1 ms. Like `reduce`, it starts from the first item when `init` is
 * left out, and rejects with a `TypeError` on empty input without `init`.
 *
 * @example
 * const total = await reducePaced(orders, (sum, order) => sum + order.price, 0);
 */
export function reducePaced<T>(items: Iterable<T>, fn: (acc: T, item: T, index: number) => T): Promise<T>;
export function reducePaced<T, U>(items: Iterable<T>, fn: (acc: U, item: T, index: number) => U, init: U): Promise<U>;

/**
 * Resolves to the first item `fn` accepts, or `undefined`, pausing for an
 * event-loop turn about every 1 ms. Like `find`. Stops at the first match.
 *
 * @example
 * const admin = await findPaced(users, user => user.role === 'admin');
 */
export function findPaced<T, S extends T>(items: Iterable<T>, fn: (item: T, index: number) => item is S): Promise<S | undefined>;
export function findPaced<T>(items: Iterable<T>, fn: Fn<T, unknown>): Promise<T | undefined>;

/**
 * Resolves to the index of the first item `fn` accepts, or `-1`, pausing for an
 * event-loop turn about every 1 ms. Like `findIndex`. Stops at the first match.
 *
 * @example
 * const index = await findIndexPaced(rows, row => row.id === id);
 */
export function findIndexPaced<T>(items: Iterable<T>, fn: Fn<T, unknown>): Promise<number>;

/**
 * Resolves to `true` if `fn` accepts any item, pausing for an event-loop turn
 * about every 1 ms. Like `some`. Stops at the first match.
 *
 * @example
 * const hasErrors = await somePaced(entries, entry => entry.level === 'error');
 */
export function somePaced<T>(items: Iterable<T>, fn: Fn<T, unknown>): Promise<boolean>;

/**
 * Resolves to `true` if `fn` accepts every item, pausing for an event-loop turn
 * about every 1 ms. Like `every`. Stops at the first miss.
 *
 * @example
 * const valid = await everyPaced(rows, row => row.id !== undefined);
 */
export function everyPaced<T>(items: Iterable<T>, fn: Fn<T, unknown>): Promise<boolean>;
