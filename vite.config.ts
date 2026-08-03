import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';

function gitInfo() {
	try {
		const sha = execSync('git rev-parse --short HEAD').toString().trim();
		const isoDate = execSync('git log -1 --format=%cI').toString().trim();
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
 * Whether this build ships the /health tuning panel.
 *
 * Deliberately not an env var read at runtime: a runtime check still bundles
 * DialKit for everyone and pays for it on production's first load. Baked in as a
 * literal, `if (__HEALTH_DIALS__)` folds to `if (false)` and the dynamic import
 * inside it becomes unreachable, so Rollup emits no chunk for the panel at all.
 *
 * Preview deployments and `vite dev` get it; production never does.
 */
const healthDials = process.env.VERCEL_ENV
	? process.env.VERCEL_ENV === 'preview'
	: process.env.NODE_ENV !== 'production';

export default defineConfig({
	define: {
		__HEALTH_DIALS__: JSON.stringify(healthDials)
	},
	server: {
		fs: {
			// Allow serving files from one level up to the project root
			allow: ['..']
		},
		allowedHosts: true
	},
	plugins: [sveltekit()]
});
