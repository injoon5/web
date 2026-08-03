// Interlude static weights (full glyph set, incl. Hangul) so Korean
// titles/labels render in OG images instead of missing-glyph boxes.
// Satori can't decode woff2 (brotli), so these are self-hosted .woff
// converted from the Interlude package and served from our own origin.
const FONT_DIR = '/fonts/interlude/og';

const FONT_FILES = {
	regular: 'Interlude-Regular.woff',
	medium: 'Interlude-Medium.woff',
	semibold: 'Interlude-SemiBold.woff',
	bold: 'Interlude-Bold.woff'
};

/**
 * The in-flight or settled load, cached rather than the result.
 *
 * Caching the resolved array left a window between the first request starting
 * its fetches and finishing them, in which every other request on a cold lambda
 * saw an empty cache and fetched all four files again. Holding the promise
 * collapses that burst into one load.
 *
 * @type {Promise<import('satori').Font[]> | null}
 */
let _fonts = null;

/**
 * Load the Interlude OG fonts, fetching from the deployment's own origin.
 * @param {string} origin  Absolute origin (e.g. https://example.com)
 * @returns {Promise<import('satori').Font[]>}
 */
export function loadFonts(origin) {
	if (_fonts) return _fonts;

	_fonts = Promise.all(
		Object.values(FONT_FILES).map((file) =>
			fetch(`${origin}${FONT_DIR}/${file}`).then((r) => r.arrayBuffer())
		)
	)
		.then(([regular, medium, semibold, bold]) => [
			{ name: 'Interlude', data: regular, weight: 400, style: 'normal' },
			{ name: 'Interlude', data: medium, weight: 500, style: 'normal' },
			{ name: 'Interlude', data: semibold, weight: 600, style: 'normal' },
			{ name: 'Interlude', data: bold, weight: 700, style: 'normal' }
		])
		.catch((err) => {
			// A failed load must not be cached, or one bad fetch breaks OG images
			// for the life of the instance.
			_fonts = null;
			throw err;
		});

	return _fonts;
}
