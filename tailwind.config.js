/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
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
