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

export default defineConfig({
	server: {
		fs: {
			// Allow serving files from one level up to the project root
			allow: ['..']
		},
		allowedHosts: true
	},
	plugins: [sveltekit()]
});
