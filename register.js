'use strict';

// Opt-in. Adds the …Paced methods to Array.prototype and Iterator.prototype
// (Node 22+), as non-enumerable methods, only where they are missing.
const methods = require('./lib/methods');

for (const proto of [Array.prototype, globalThis.Iterator?.prototype]) {
	if (!proto) {
		continue;
	}
	for (const [name, fn] of Object.entries(methods)) {
		if (Object.prototype.hasOwnProperty.call(proto, name)) {
			continue;
		}
		Object.defineProperty(proto, name, {
			value: function (...args) {
				return fn(this, ...args);
			},
			writable: true,
			configurable: true,
			enumerable: false,
		});
	}
}
