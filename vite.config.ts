import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	server: {
		fs: {
			// Allow serving files from one level up to the project root
			allow: ['..']
		},
		allowedHosts: true
	},
	plugins: [sveltekit()],
	test: {
		environment: 'node',
		include: ['src/**/*.test.js'],
		clearMocks: true,
		alias: {
			'$env/static/private': '/home/user/web/src/tests/mocks/env.js',
			'$lib': '/home/user/web/src/lib'
		}
	}
});
