import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';

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
// Expose to client via SvelteKit's $env/static/public. PUBLIC_* prefix is required.
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
	plugins: [tailwindcss(), sveltekit()]
});
