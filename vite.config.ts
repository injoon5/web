import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { mdsvex } from 'mdsvex';
import { execSync } from 'node:child_process';

import mdsvexConfig from './mdsvex.config.js';

function gitInfo() {
	try {
		// One `git log` for both fields — this config is evaluated more than once
		// per build, and each spawn is a process.
		const [sha, isoDate] = execSync('git log -1 --format=%h%n%cI').toString().trim().split('\n');
		return { sha, isoDate };
	} catch {
		return { sha: '', isoDate: '' };
	}
}

const { sha, isoDate } = gitInfo();
// Read at build time and inlined by src/env.js (`static: true`).
process.env.PUBLIC_GIT_COMMIT = sha;
process.env.PUBLIC_GIT_COMMIT_DATE = isoDate;

/**
 * Whether this build ships the DialKit tuning panels.
 *
 * Deliberately not an env var read at runtime: a runtime check still bundles
 * DialKit for everyone and pays for it on production's first load. Baked in as a
 * literal, `if (__DIALS__)` folds to `if (false)` and the dynamic import inside
 * it becomes unreachable, so Rollup emits no chunk for the panels at all.
 *
 * `VERCEL_ENV` is `production` | `preview` | `development`, and is set at build
 * time as well as runtime — so everything that isn't production gets the panel,
 * including `vercel dev`. Off Vercel entirely, fall back to the Node env.
 */
const dials = process.env.VERCEL_ENV
	? process.env.VERCEL_ENV !== 'production'
	: process.env.NODE_ENV !== 'production';

export default defineConfig({
	define: {
		__DIALS__: JSON.stringify(dials)
	},
	server: {
		fs: {
			// Allow serving files from one level up to the project root
			allow: ['..']
		},
		allowedHosts: true
	},
	// Tailwind runs as a Vite plugin rather than through PostCSS: Vite's own
	// postcss-import pass resolves `@import 'tailwindcss'` as a file path and
	// fails before `@tailwindcss/postcss` ever sees it.
	plugins: [
		tailwindcss(),
		sveltekit({
			extensions: ['.svelte', '.md'],
			// remark-math 3 in mdsvex.config.js doesn't fit mdsvex's plugin types. That
			// went unnoticed while this call lived in svelte.config.js, which is unchecked.
			preprocess: [vitePreprocess(), mdsvex(mdsvexConfig as Parameters<typeof mdsvex>[0])],
			onwarn(warning, handler) {
				const mdA11y =
					warning.filename?.endsWith('.md') &&
					(warning.code === 'a11y_no_noninteractive_tabindex' ||
						warning.code === 'a11y_img_redundant_alt');
				if (mdA11y) return;
				handler(warning);
			},
			adapter: adapter()
		})
	]
});
