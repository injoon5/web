import { browser } from '$app/environment';

// One subscription for the whole app. The eight hand-rolled copies this replaces
// mostly read the query once on mount, so they never noticed the OS setting
// changing mid-session.
let reduced = $state(false);

if (browser) {
	const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
	reduced = mq.matches;
	mq.addEventListener('change', (e) => (reduced = e.matches));
}

export const motion = {
	get reduced() {
		return reduced;
	}
};
