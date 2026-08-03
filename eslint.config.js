import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

export default ts.config(
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
				// Baked in by `vite.config.ts` as a literal, so it is never a lexical
				// binding at lint time — see `src/app.d.ts`.
				__DIALS__: 'readonly'
			}
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.js', '**/*.svelte.ts'],
		languageOptions: {
			parserOptions: {
				// The TS parser handles `<script lang="ts">`; `svelteConfig` lets the
				// Svelte parser resolve the same preprocessors the build uses, so
				// `.md` routes and rune modules parse identically here.
				parser: ts.parser,
				svelteConfig
			}
		},
		rules: {
			// A bare `value;` inside `$effect` is how a rune registers a dependency it
			// does not otherwise read. There is no call or assignment to point at, so
			// the rule can only ever be wrong here.
			'@typescript-eslint/no-unused-expressions': 'off'
		}
	},
	{
		// The site has no `base` path, so every internal href is already the final
		// URL. `resolve()` would add a per-link import and a runtime call to produce
		// the identical string.
		rules: { 'svelte/no-navigation-without-resolve': 'off' }
	},
	{
		// SvelteKit's own `App` namespace template — empty by design, and filling it
		// in with `object` would change what the interfaces mean.
		files: ['src/app.d.ts'],
		rules: { '@typescript-eslint/no-empty-object-type': 'off' }
	},
	{
		// Generated, vendored or non-source trees. Flat config has no
		// `.eslintignore`, so every ignore lives here.
		ignores: [
			'.DS_Store',
			'node_modules/',
			'build/',
			'.svelte-kit/',
			'.vercel/',
			'.cache/',
			'package/',
			'convex/_generated/',
			'static/',
			'.env',
			'.env.*',
			'!.env.example',
			'pnpm-lock.yaml',
			'package-lock.json',
			'yarn.lock'
		]
	}
);
