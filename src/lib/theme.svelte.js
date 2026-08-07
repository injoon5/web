import { browser } from '$app/environment';

// The inline script in app.html owns the `dark`/`light` classes on <html> — it
// has to, since it runs before hydration and is what prevents a flash of the
// wrong theme. This only observes that decision so components can react to it.
let current = $state(
	browser && document.documentElement.classList.contains('dark') ? 'dark' : 'light'
);

export const theme = {
	get current() {
		return current;
	},
	/** Track OS theme changes. Returns a cleanup function. */
	watch() {
		if (!browser) return;
		const mql = window.matchMedia('(prefers-color-scheme: dark)');
		const handler = () => (current = mql.matches ? 'dark' : 'light');
		mql.addEventListener('change', handler);
		return () => mql.removeEventListener('change', handler);
	}
};
