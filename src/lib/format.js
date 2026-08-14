// @ts-check

/** @typedef {Intl.DateTimeFormatOptions['dateStyle']} DateStyle */

/**
 * Article dates: "Jan 5, 2026".
 * @param {string | undefined | null} date
 * @param {DateStyle} [dateStyle]
 * @param {string} [locales]
 */
export function formatDate(date, dateStyle = 'medium', locales = 'en-US') {
	if (!date) return '';
	// Safari is mad about dashes in the date.
	return new Intl.DateTimeFormat(locales, { dateStyle }).format(
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

/**
 * @param {string | undefined | null} description
 * @param {number} limit
 */
export function sliceText(description, limit) {
	if (!description) return '';
	const words = description.split(' ');
	return words.length <= limit ? description : words.slice(0, limit).join(' ') + '...';
}
