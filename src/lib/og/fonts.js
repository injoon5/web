// Full Pretendard (not the @fontsource `latin` subset, which has no Hangul) so
// Korean titles/labels render in OG images instead of missing-glyph boxes.
const FONT_BASE = 'https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/static/woff';

const FONT_URLS = {
	regular: `${FONT_BASE}/Pretendard-Regular.woff`,
	medium: `${FONT_BASE}/Pretendard-Medium.woff`,
	semibold: `${FONT_BASE}/Pretendard-SemiBold.woff`,
	bold: `${FONT_BASE}/Pretendard-Bold.woff`
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
