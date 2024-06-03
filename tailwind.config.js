/** @type {import('tailwindcss').Config} */

export default {
	content: ['./src/**/*.{html,js,svelte,ts}', './node_modules/svhighlight/**/*.svelte'],
	theme: {
		fontFamily: {
			sans: [
				'ui-sans-serif',
				'system-ui',
				'-apple-system',
				'BlinkMacSystemFont',
				'Pretendard',
				'Segoe UI',
				'Roboto',
				'Helvetica Neue',
				'Arial',
				'Noto Sans',
				'sans-serif',
				'Apple Color Emoji',
				'Segoe UI Emoji',
				'Segoe UI Symbol',
				'Noto Color Emoji'
			],
			serif: ['ui-serif', 'Georgia', 'Cambria', 'Times New Roman', 'Times', 'serif'],
			mono: [
				'ui-monospace',
				'SFMono-Regular',
				'Menlo',
				'Monaco',
				'Consolas',
				'Liberation Mono',
				'Courier New',
				'monospace'
			],
			array: ['Array']
		},
		extend: {
			typography: ({ theme }) => ({
				DEFAULT: {
					css: {
						color: '#fff',
						'--tw-prose-invert-body': theme('colors.black[200]'),
						'--tw-prose-invert-headings': theme('colors.white'),
						'--tw-prose-invert-lead': theme('colors.black[300]'),
						'--tw-prose-invert-links': theme('colors.white'),
						'--tw-prose-invert-bold': theme('colors.white'),
						'--tw-prose-invert-counters': theme('colors.black[200]'),
						'--tw-prose-invert-bullets': theme('colors.black[200]'),
						'--tw-prose-invert-hr': theme('colors.black[500]'),
						'--tw-prose-invert-quotes': theme('colors.black[100]'),
						'--tw-prose-invert-quote-borders': theme('colors.black[700]'),
						'--tw-prose-invert-captions': theme('colors.black[400]'),
						'--tw-prose-invert-th-borders': theme('colors.black[500]'),
						'--tw-prose-invert-td-borders': theme('colors.black[600]')
					}
				}
			})
		}
	},
	plugins: [require('@tailwindcss/typography')]
};
