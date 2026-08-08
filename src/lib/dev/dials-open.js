const KEY = 'dialkit-open';

/**
 * Whether the DialKit overlay should start open.
 *
 * Open is the default: a preview build that has never been touched should still
 * show the panel. Only an explicit collapse is remembered, so the choice you
 * made mid-article survives the refresh.
 *
 * @returns {boolean}
 */
export function readDialsOpen() {
	try {
		return localStorage.getItem(KEY) !== '0';
	} catch {
		// Storage can be absent (SSR) or throw outright (Safari private mode,
		// third-party-cookie blocking). A panel that opens is the safe fallback.
		return true;
	}
}

/**
 * Remember the overlay's open state. Never throws — the panel is a dev tool and
 * unwritable storage is not worth an error boundary.
 *
 * @param {boolean} open
 */
export function writeDialsOpen(open) {
	try {
		localStorage.setItem(KEY, open ? '1' : '0');
	} catch {
		// Ignored, same reasons as above.
	}
}
