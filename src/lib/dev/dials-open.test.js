import { describe, it, expect, afterEach } from 'vitest';
import { readDialsOpen, writeDialsOpen } from './dials-open.js';

/** Minimal localStorage stand-in — the node project has no DOM. */
function stubStorage(store = new Map()) {
	Object.defineProperty(globalThis, 'localStorage', {
		configurable: true,
		value: {
			getItem: (k) => (store.has(k) ? store.get(k) : null),
			setItem: (k, v) => store.set(k, String(v))
		}
	});
	return store;
}

function stubThrowingStorage() {
	Object.defineProperty(globalThis, 'localStorage', {
		configurable: true,
		get() {
			throw new DOMException('denied', 'SecurityError');
		}
	});
}

afterEach(() => {
	delete (/** @type {any} */ (globalThis).localStorage);
});

describe('dials open state', () => {
	it('defaults to open when nothing has been stored', () => {
		stubStorage();
		expect(readDialsOpen()).toBe(true);
	});

	it('round-trips a collapse', () => {
		stubStorage();
		writeDialsOpen(false);
		expect(readDialsOpen()).toBe(false);
	});

	it('round-trips a re-open', () => {
		const store = stubStorage();
		writeDialsOpen(false);
		writeDialsOpen(true);
		expect(readDialsOpen()).toBe(true);
		expect(store.get('dialkit-open')).toBe('1');
	});

	it('falls back to open with no storage at all', () => {
		expect(readDialsOpen()).toBe(true);
	});

	it('survives storage that throws', () => {
		stubThrowingStorage();
		expect(() => writeDialsOpen(false)).not.toThrow();
		expect(readDialsOpen()).toBe(true);
	});
});
