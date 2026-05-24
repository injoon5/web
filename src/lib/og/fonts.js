const FONT_URLS = {
	'Inter-Regular': 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hjQ.ttf',
	'Inter-Medium': 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fAZ9hjQ.ttf',
	'Inter-SemiBold': 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYAZ9hjQ.ttf',
	'Inter-Bold': 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZ9hjQ.ttf'
};

/** @type {import('satori').Font[] | null} */
let _fonts = null;

export async function loadFonts() {
	if (_fonts) return _fonts;

	const [regular, medium, semibold, bold] = await Promise.all(
		Object.values(FONT_URLS).map((url) => fetch(url).then((r) => r.arrayBuffer()))
	);

	_fonts = [
		{ name: 'Inter', data: regular, weight: 400, style: 'normal' },
		{ name: 'Inter', data: medium, weight: 500, style: 'normal' },
		{ name: 'Inter', data: semibold, weight: 600, style: 'normal' },
		{ name: 'Inter', data: bold, weight: 700, style: 'normal' }
	];

	return _fonts;
}
