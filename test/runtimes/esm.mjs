// Checks that ESM code can import the named exports and the register subpath.
import { mapPaced, pace } from 'paceifier';
import 'paceifier/register';

const ok = typeof pace === 'function'
	&& JSON.stringify(await mapPaced([1, 2], x => x * 10)) === '[10,20]'
	&& JSON.stringify(await [3].mapPaced(x => x + 1)) === '[4]';
console.log(`${ok ? 'ok  ' : 'FAIL'} ESM import`);
if (!ok) process.exit(1);
