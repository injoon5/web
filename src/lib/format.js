// @ts-check

/**
 * Article dates: "Jan 5, 2026".
 * @param {string | undefined | null} date
 */
export function formatDate(date) {
	if (!date) return '';
	// Safari is mad about dashes in the date.
	return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(
		new Date(date.replaceAll('-', '/'))
	);
}

/**
 * OG card dates, spelled out in Korean.
 * @param {string | undefined} date
 */
export function formatDateLong(date) {
	if (!date) return '';
	try {
		return new Date(date).toLocaleDateString('ko-KR', {
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		});
	} catch {
		return date;
	}
}

/**
 * Admin tables: date and time, in the viewer's locale.
 * @param {string | number | Date} date
 */
export function formatDateTime(date) {
	return new Date(date).toLocaleString();
}

const RELATIVE_UNITS = /** @type {const} */ ([
	['year', 60 * 60 * 24 * 365],
	['month', 60 * 60 * 24 * 30],
	['week', 60 * 60 * 24 * 7],
	['day', 60 * 60 * 24],
	['hour', 60 * 60],
	['minute', 60]
]);

const relativeFormat = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/**
 * "3 hours ago", in the largest unit that fits. `now` is a parameter so the
 * caller decides when the clock is read.
 *
 * @param {number | Date} time
 * @param {number} [now]
 */
export function formatRelative(time, now = Date.now()) {
	const diff = Math.round((Number(time) - now) / 1000);
	for (const [unit, secs] of RELATIVE_UNITS) {
		if (Math.abs(diff) >= secs) return relativeFormat.format(Math.round(diff / secs), unit);
	}
	return 'just now';
}
