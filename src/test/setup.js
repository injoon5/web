// Component-test setup: register jest-dom matchers. Auto-cleanup between tests
// is provided by the svelteTesting() plugin in vitest.config.ts.
import '@testing-library/jest-dom/vitest';

// jsdom ships no matchMedia, and Svelte's motion helpers read
// `prefers-reduced-motion` through it at import time — so anything pulling in a
// spring (layerchart, for one) throws before a test body ever runs.
// Same story for ResizeObserver, which every layerchart Chart installs to size
// itself. A chart in jsdom has no layout to observe, so a no-op is enough.
if (typeof globalThis.ResizeObserver === 'undefined') {
	globalThis.ResizeObserver = class {
		observe() {}
		unobserve() {}
		disconnect() {}
	};
}

if (typeof window !== 'undefined' && !window.matchMedia) {
	window.matchMedia = (query) => ({
		matches: false,
		media: query,
		onchange: null,
		addEventListener: () => {},
		removeEventListener: () => {},
		addListener: () => {},
		removeListener: () => {},
		dispatchEvent: () => false
	});
}
