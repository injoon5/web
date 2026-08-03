// Test stand-in for SvelteKit's `$app/state`. The real module exports a
// fine-grained reactive object, so this one is `$state`-backed: components read
// `page.url` / `page.data` directly (no `$` prefix), and `setPage()` drives it
// between cases.

const DEFAULT_PAGE = {
	url: new URL('http://localhost/blog/test'),
	data: { ipHash: 'test-ip-hash' },
	params: {},
	route: { id: null },
	status: 200,
	error: null,
	form: null,
	state: {}
};

export const page = $state({ ...DEFAULT_PAGE });
export const navigating = $state({ from: null, to: null, type: null, complete: null });
export const updated = $state({ current: false });

/** Reset `page` to a known default; optionally merge overrides. */
export function setPage(overrides = {}) {
	Object.assign(page, DEFAULT_PAGE, overrides);
}
