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

/** @type {import('satori').Font[] | null} */
let _fonts = null;

/**
 * Load the Interlude OG fonts, fetching from the deployment's own origin.
 * @param {string} origin  Absolute origin (e.g. https://example.com)
 */
export async function loadFonts(origin) {
	if (_fonts) return _fonts;

	const [regular, medium, semibold, bold] = await Promise.all(
		Object.values(FONT_FILES).map((file) =>
			fetch(`${origin}${FONT_DIR}/${file}`).then((r) => r.arrayBuffer())
		)
	);

	_fonts = [
		{ name: 'Interlude', data: regular, weight: 400, style: 'normal' },
		{ name: 'Interlude', data: medium, weight: 500, style: 'normal' },
		{ name: 'Interlude', data: semibold, weight: 600, style: 'normal' },
		{ name: 'Interlude', data: bold, weight: 700, style: 'normal' }
	];

	return _fonts;
}
