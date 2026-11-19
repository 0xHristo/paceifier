export {};

interface PacedMethods<T> {
	forEachPaced(fn: (item: T, index: number) => void): Promise<void>;
	mapPaced<U>(fn: (item: T, index: number) => U): Promise<U[]>;
	filterPaced(fn: (item: T, index: number) => unknown): Promise<T[]>;
	flatMapPaced<U>(fn: (item: T, index: number) => U | readonly U[]): Promise<U[]>;
	reducePaced(fn: (acc: T, item: T, index: number) => T): Promise<T>;
	reducePaced<U>(fn: (acc: U, item: T, index: number) => U, init: U): Promise<U>;
	findPaced(fn: (item: T, index: number) => unknown): Promise<T | undefined>;
	findIndexPaced(fn: (item: T, index: number) => unknown): Promise<number>;
	somePaced(fn: (item: T, index: number) => unknown): Promise<boolean>;
	everyPaced(fn: (item: T, index: number) => unknown): Promise<boolean>;
}

declare global {
	interface Array<T> extends PacedMethods<T> {}
	interface IteratorObject<T, TReturn, TNext> extends PacedMethods<T> {}
}
