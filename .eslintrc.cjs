/** @type { import("eslint").Linter.Config } */
module.exports = {
	root: true,
	extends: [
		'eslint:recommended',
		'plugin:@typescript-eslint/recommended',
		'plugin:svelte/recommended',
		'prettier'
	],
	parser: '@typescript-eslint/parser',
	plugins: ['@typescript-eslint'],
	parserOptions: {
		sourceType: 'module',
		ecmaVersion: 2022,
		extraFileExtensions: ['.svelte']
	},
	env: {
		browser: true,
		// 2022, not 2017: `globalThis` arrived in ES2020 and `src/test/setup.js`
		// uses it, so the old floor made `eslint .` fail on a file that is
		// perfectly valid. The codebase already relies on ES2022 anyway (`.at()`,
		// `replaceAll`).
		es2022: true,
		node: true
	},
	globals: {
		// Baked in by `vite.config.ts` as a literal, so it is never a lexical
		// binding at lint time — see `src/app.d.ts`.
		__DIALS__: 'readonly'
	},
	overrides: [
		{
			files: ['*.svelte'],
			parser: 'svelte-eslint-parser',
			parserOptions: {
				parser: '@typescript-eslint/parser'
			}
		},
		{
			// Svelte 5 rune modules (`.svelte.js` / `.svelte.ts`) use compiler macros
			// that aren't lexical globals; declare them so no-undef doesn't fire.
			files: ['*.svelte.js', '*.svelte.ts'],
			globals: {
				$state: 'readonly',
				$derived: 'readonly',
				$effect: 'readonly',
				$props: 'readonly',
				$bindable: 'readonly',
				$inspect: 'readonly',
				$host: 'readonly'
			}
		}
	]
};
