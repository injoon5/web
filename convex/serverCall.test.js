/**
 * Every public function that trusts an `ipHash` argument must demand the
 * server credential, and `SERVER_CALL_FUNCTIONS` is the list the test helper
 * and the e2e fake rely on to send it. This keeps that list honest.
 */
import { describe, expect, it } from 'vitest';
import { SERVER_CALL_FUNCTIONS } from './lib/serverCall.js';

const modules = import.meta.glob(['./*.js', '!./*.test.js', '!./*.config.js'], { eager: true });

/** Public writes (mutations and actions) whose arguments include `arg`. */
function publicWritesTaking(arg) {
	const names = [];
	for (const [path, mod] of Object.entries(modules)) {
		const file = path.slice(2, -3);
		for (const [name, fn] of Object.entries(mod)) {
			if (!fn?.isPublic || !(fn.isMutation || fn.isAction)) continue;
			const args = JSON.parse(fn.exportArgs());
			if (args.type === 'object' && arg in args.value) names.push(`${file}:${name}`);
		}
	}
	return names.sort();
}

describe('SERVER_CALL_FUNCTIONS', () => {
	it('is exactly the public writes that take an ipHash', () => {
		expect(publicWritesTaking('ipHash')).toEqual([...SERVER_CALL_FUNCTIONS].sort());
	});

	it('names only functions that demand the credential', () => {
		expect(publicWritesTaking('serverCredential')).toEqual([...SERVER_CALL_FUNCTIONS].sort());
	});
});
