const FONT_BASE = 'https://cdn.jsdelivr.net/npm/@fontsource/pretendard@5.2.5/files';

const FONT_URLS = {
	regular: `${FONT_BASE}/pretendard-latin-400-normal.woff`,
	medium: `${FONT_BASE}/pretendard-latin-500-normal.woff`,
	semibold: `${FONT_BASE}/pretendard-latin-600-normal.woff`,
	bold: `${FONT_BASE}/pretendard-latin-700-normal.woff`
};

/** @type {import('satori').Font[] | null} */
let _fonts = null;

export async function loadFonts() {
	if (_fonts) return _fonts;

	const [regular, medium, semibold, bold] = await Promise.all(
		Object.values(FONT_URLS).map((url) => fetch(url).then((r) => r.arrayBuffer()))
	);

	_fonts = [
		{ name: 'Pretendard', data: regular, weight: 400, style: 'normal' },
		{ name: 'Pretendard', data: medium, weight: 500, style: 'normal' },
		{ name: 'Pretendard', data: semibold, weight: 600, style: 'normal' },
		{ name: 'Pretendard', data: bold, weight: 700, style: 'normal' }
	];

	return _fonts;
}
