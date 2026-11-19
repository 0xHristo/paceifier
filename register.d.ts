// Types for `require('paceifier/register')` or `import 'paceifier/register'`,
// which add the paced methods to arrays and iterators. Each method works like
// the function of the same name in paceifier, with `this` as the items.
export {};

interface PacedMethods<T> {
	/** Calls `fn` for every item, pausing about every 1 ms. Like `forEach`. */
	forEachPaced(fn: (item: T, index: number) => void): Promise<void>;
	/** Resolves to a new array of the results of `fn`. Like `map`. */
	mapPaced<U>(fn: (item: T, index: number) => U): Promise<U[]>;
	/** Resolves to a new array of the items `fn` accepts. Like `filter`. */
	filterPaced<S extends T>(fn: (item: T, index: number) => item is S): Promise<S[]>;
	filterPaced(fn: (item: T, index: number) => unknown): Promise<T[]>;
	/** Resolves to the results of `fn`, flattened one level. Like `flatMap`. */
	flatMapPaced<U>(fn: (item: T, index: number) => U | readonly U[]): Promise<U[]>;
	/** Resolves to the value accumulated by `fn`. Like `reduce`. */
	reducePaced(fn: (acc: T, item: T, index: number) => T): Promise<T>;
	reducePaced<U>(fn: (acc: U, item: T, index: number) => U, init: U): Promise<U>;
	/** Resolves to the first item `fn` accepts, or `undefined`. Like `find`. */
	findPaced<S extends T>(fn: (item: T, index: number) => item is S): Promise<S | undefined>;
	findPaced(fn: (item: T, index: number) => unknown): Promise<T | undefined>;
	/** Resolves to the index of the first item `fn` accepts, or `-1`. Like `findIndex`. */
	findIndexPaced(fn: (item: T, index: number) => unknown): Promise<number>;
	/** Resolves to `true` if `fn` accepts any item. Like `some`. */
	somePaced(fn: (item: T, index: number) => unknown): Promise<boolean>;
	/** Resolves to `true` if `fn` accepts every item. Like `every`. */
	everyPaced(fn: (item: T, index: number) => unknown): Promise<boolean>;
}

declare global {
	interface Array<T> extends PacedMethods<T> {}
	interface IteratorObject<T, TReturn, TNext> extends PacedMethods<T> {}
}
