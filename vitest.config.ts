import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Unit-test config (kept separate from vite.config.ts so the SvelteKit build is
// untouched). SvelteKit's `$env`/`$lib`/`$convex` specifiers are aliased here so
// server helpers can be imported directly; `$env/static/private` resolves to a
// stub with deterministic test secrets.
export default defineConfig({
	resolve: {
		alias: {
			'$env/static/private': fileURLToPath(
				new URL('./src/test/mocks/env-static-private.js', import.meta.url)
			),
			$lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
			$convex: fileURLToPath(new URL('./convex', import.meta.url))
		}
	},
	test: {
		environment: 'node',
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
});
