// Test stand-in for SvelteKit's `$app/stores`. `page` is a writable so tests can
// drive `$page.url` / `$page.data` (e.g. ipHash) and reset it between cases.
import { writable } from 'svelte/store';

const DEFAULT_PAGE = {
	url: new URL('http://localhost/blog/test'),
	data: { ipHash: 'test-ip-hash' },
	params: {},
	route: { id: null }
};

export const page = writable(DEFAULT_PAGE);
export const navigating = writable(null);
export const updated = writable(false);

/** Reset `page` to a known default; optionally merge overrides. */
export function setPage(overrides = {}) {
	page.set({ ...DEFAULT_PAGE, ...overrides });
}
