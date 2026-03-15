import { readingTime } from './readingTime.js';

/**
 * Remark plugin that computes reading time at build time and injects it
 * into the mdsvex frontmatter metadata as `readingTime`.
 */
export function remarkReadingTime() {
	return function (tree, file) {
		const lang = file.path?.includes('/ko/') ? 'ko' : 'en';
		const raw = file.value ?? '';
		file.data.fm = file.data.fm ?? {};
		file.data.fm.readingTime = readingTime(raw, lang);
	};
}
