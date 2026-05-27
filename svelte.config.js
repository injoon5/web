import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { mdsvex } from 'mdsvex';

import mdsvexConfig from './mdsvex.config.js';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	extensions: ['.svelte', '.md'],
	preprocess: [vitePreprocess(), mdsvex(mdsvexConfig)],

	onwarn(warning, handler) {
		const mdA11y =
			warning.filename?.endsWith('.md') &&
			(warning.code === 'a11y_no_noninteractive_tabindex' ||
				warning.code === 'a11y_img_redundant_alt');
		if (mdA11y) return;
		handler(warning);
	},

	kit: {
		adapter: adapter(),
		alias: {
			$convex: './convex'
		}
	}
};

export default config;
