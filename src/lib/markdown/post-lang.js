/**
 * The language of the post a markdown plugin is compiling, from where its file
 * lives (`src/content/<kind>/<lang>/<slug>.md`). Either separator, so a Windows
 * checkout builds the same.
 *
 * @param {{ filename?: string, path?: string } | undefined} file  the vfile
 * @returns {'ko' | 'en'}
 */
export function postLang(file) {
	const where = String(file?.filename ?? file?.path ?? '');
	return /[/\\]ko[/\\]/.test(where) ? 'ko' : 'en';
}
