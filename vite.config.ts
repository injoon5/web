import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, searchForWorkspaceRoot } from 'vite';

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
