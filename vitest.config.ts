import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';
import { fileURLToPath } from 'node:url';

const r = (p) => fileURLToPath(new URL(p, import.meta.url));

// SvelteKit's `$env`/`$app`/`$lib`/`$convex` specifiers (and a couple of
// browser-only deps) are aliased to lightweight stubs so modules and components
// can be imported directly, without spinning up the full SvelteKit/Vite plugin.
const sharedAlias = {
	'$env/static/private': r('./src/test/mocks/env-static-private.js'),
	'$app/stores': r('./src/test/mocks/app-stores.js'),
	'$app/environment': r('./src/test/mocks/app-environment.js'),
	'web-haptics/svelte': r('./src/test/mocks/web-haptics.js'),
	'@number-flow/svelte': r('./src/test/mocks/NumberFlow.svelte'),
	$lib: r('./src/lib'),
	$convex: r('./convex')
};

export default defineConfig({
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
