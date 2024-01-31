/** @type {import('tailwindcss').Config} */

const { colors: defaultColors } = require('tailwindcss/defaultTheme');

const colors = {
	...defaultColors,
	...{
		primary: {
			50: '#f6f6f6',
			100: '#e7e7e7',
			200: '#d1d1d1',
			300: '#b0b0b0',
			400: '#888888',
			500: '#6d6d6d',
			600: '#5d5d5d',
			700: '#4f4f4f',
			800: '#454545',
			900: '#343434',
			950: '#262626',
			1000: '#1D1D1D'
		}
	}
};

export default {
	content: ['./src/**/*.{html,js,svelte,ts}', './node_modules/svhighlight/**/*.svelte'],
	theme: {
		colors: colors,
		fontFamily: {
			sans: ['Pretendard'],
			serif: ['Newsreader'],
			rubik: ['Rubik']
		},
		extend: {
			typography: ({ theme }) => ({
				DEFAULT: {
					css: {
						color: '#fff',
						'--tw-prose-invert-body': theme('colors.primary[200]'),
						'--tw-prose-invert-headings': theme('colors.white'),
						'--tw-prose-invert-lead': theme('colors.primary[300]'),
						'--tw-prose-invert-links': theme('colors.white'),
						'--tw-prose-invert-bold': theme('colors.white'),
						'--tw-prose-invert-counters': theme('colors.primary[200]'),
						'--tw-prose-invert-bullets': theme('colors.primary[200]'),
						'--tw-prose-invert-hr': theme('colors.primary[500]'),
						'--tw-prose-invert-quotes': theme('colors.primary[100]'),
						'--tw-prose-invert-quote-borders': theme('colors.primary[700]'),
						'--tw-prose-invert-captions': theme('colors.primary[400]'),
						'--tw-prose-invert-th-borders': theme('colors.primary[500]'),
						'--tw-prose-invert-td-borders': theme('colors.primary[600]')
					}
				}
			})
		}
	},
	plugins: [require('@tailwindcss/typography')]
};
