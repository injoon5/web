/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
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
