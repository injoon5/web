/**
 * Small formatting helpers shared by the shelf, the /books list and the
 * individual book pages.
 */

/** 'Mar 2026' — the resolution a finished-reading date actually deserves. */
export function formatMonth(date) {
	if (!date) return '';
	try {
		// Safari is mad about dashes in date strings.
		return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(
			new Date(String(date).replaceAll('-', '/'))
		);
	} catch {
		return '';
	}
}

/**
 * Ratings are stored 0–5 and may be half steps. Returns the five marks the
 * rating renders as, so the markup stays a simple loop.
 */
export function ratingMarks(rating) {
	const value = Number(rating);
	if (!Number.isFinite(value) || value <= 0) return [];
	return Array.from({ length: 5 }, (_, i) => {
		if (value >= i + 1) return 'full';
		if (value >= i + 0.5) return 'half';
		return 'empty';
	});
}
