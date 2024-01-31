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
			serif: ['Newsreader']
		},
		extend: {
			typography: {
				DEFAULT: {
					css: {
						color: '#fff'
					}
				}
			}
		}
	},
	plugins: [require('@tailwindcss/typography')]
};
