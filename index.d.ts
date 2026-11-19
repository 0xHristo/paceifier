type Fn<T, R> = (item: T, index: number) => R;

/**
 * Returns undefined while the current slice has time left, or a promise that
 * resolves once the event loop has had a turn.
 */
export function immediate(): Promise<void> | undefined;

export function forEachPaced<T>(items: Iterable<T>, fn: Fn<T, void>): Promise<void>;
export function mapPaced<T, U>(items: Iterable<T>, fn: Fn<T, U>): Promise<U[]>;
export function filterPaced<T, S extends T>(items: Iterable<T>, fn: (item: T, index: number) => item is S): Promise<S[]>;
export function filterPaced<T>(items: Iterable<T>, fn: Fn<T, unknown>): Promise<T[]>;
export function flatMapPaced<T, U>(items: Iterable<T>, fn: Fn<T, U | readonly U[]>): Promise<U[]>;
export function reducePaced<T>(items: Iterable<T>, fn: (acc: T, item: T, index: number) => T): Promise<T>;
export function reducePaced<T, U>(items: Iterable<T>, fn: (acc: U, item: T, index: number) => U, init: U): Promise<U>;
export function findPaced<T>(items: Iterable<T>, fn: Fn<T, unknown>): Promise<T | undefined>;
export function findIndexPaced<T>(items: Iterable<T>, fn: Fn<T, unknown>): Promise<number>;
export function somePaced<T>(items: Iterable<T>, fn: Fn<T, unknown>): Promise<boolean>;
export function everyPaced<T>(items: Iterable<T>, fn: Fn<T, unknown>): Promise<boolean>;
