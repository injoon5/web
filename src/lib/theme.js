import { writable } from 'svelte/store';
import { browser } from '$app/environment';

function createTheme() {
	const initial = browser
		? document.documentElement.classList.contains('dark') ? 'dark' : 'light'
		: 'light';

	const { subscribe, set } = writable(initial);

	return {
		subscribe,
		syncWithOS() {
			if (!browser) return;
			const mql = window.matchMedia('(prefers-color-scheme: dark)');
			const handler = (e) => {
				const value = e.matches ? 'dark' : 'light';
				document.documentElement.classList.toggle('dark', e.matches);
				document.documentElement.classList.toggle('light', !e.matches);
				set(value);
			};
			mql.addEventListener('change', handler);
			return () => mql.removeEventListener('change', handler);
		}
	};
}

export const theme = createTheme();
