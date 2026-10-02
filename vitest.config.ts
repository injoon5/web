import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';
import { fileURLToPath } from 'node:url';

const r = (p) => fileURLToPath(new URL(p, import.meta.url));

// SvelteKit's `$app` modules (and a couple of browser-only deps) are aliased
// to lightweight stubs so modules and components can be imported directly,
// without spinning up the full SvelteKit/Vite plugin. `#lib` and `#convex`
// need no entry: they are package.json subpath imports, which Vite resolves
// on its own.
//
// Anchored, because a string alias also matches as a path prefix — `$app/env`
// would otherwise swallow `$app/env/private`.
const sharedAlias = [
	{ find: /^\$app\/env\/private$/, replacement: r('./src/test/mocks/app-env-private.js') },
	{ find: /^\$app\/env$/, replacement: r('./src/test/mocks/app-env.js') },
	{ find: /^\$app\/state$/, replacement: r('./src/test/mocks/app-state.svelte.js') },
	{ find: /^web-haptics\/svelte$/, replacement: r('./src/test/mocks/web-haptics.js') },
	{ find: /^#lib\/ui\/NumberFlow\.svelte$/, replacement: r('./src/test/mocks/NumberFlow.svelte') }
];

export default defineConfig({
	// Mirrors `vite.config.ts`. Tests exercise the shipped path, so the /health
	// tuning panel is compiled out here the same way it is in production.
	define: {
		__DIALS__: 'false'
	},
	test: {
		projects: [
			{
				// Pure logic / server helpers — fast, no DOM.
				resolve: { alias: sharedAlias },
				test: {
					name: 'unit',
					environment: 'node',
					// convex/lib holds pure helpers (no ctx, no Convex imports), so they
					// run here alongside the SvelteKit server helpers.
					include: ['src/**/*.test.js', 'convex/lib/**/*.test.js'],
					exclude: ['src/**/*.svelte.test.js']
				}
			},
			{
				// Convex functions — convex-test runs them against an in-memory
				// deployment, which needs the edge runtime.
				resolve: { alias: sharedAlias },
				test: {
					name: 'convex',
					environment: 'edge-runtime',
					include: ['convex/*.test.js'],
					server: { deps: { inline: ['convex-test'] } }
				}
			},
			{
				// Svelte component tests — jsdom + Testing Library.
				plugins: [svelte(), svelteTesting()],
				resolve: { alias: sharedAlias },
				test: {
					name: 'component',
					environment: 'jsdom',
					include: ['src/**/*.svelte.test.js'],
					setupFiles: ['./src/test/setup.js']
				}
			}
		]
	}
});
