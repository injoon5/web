import { toString } from 'mdast-util-to-string';

const EN_WORDS_PER_MINUTE = 200;
const KO_CHARS_PER_MINUTE = 500;

/**
 * Remark plugin that computes reading time at build time from the parsed AST
 * and injects it into the mdsvex frontmatter metadata as `readingTime`.
 */
export function remarkReadingTime() {
	return function (tree, file) {
		const lang = file.path?.includes('/ko/') ? 'ko' : 'en';
		const text = toString(tree);

		let minutes;
		if (lang === 'ko') {
			const chars = text.replace(/\s+/g, '').length;
			minutes = Math.max(1, Math.ceil(chars / KO_CHARS_PER_MINUTE));
		} else {
			const words = text.split(/\s+/).filter(Boolean).length;
			minutes = Math.max(1, Math.ceil(words / EN_WORDS_PER_MINUTE));
		}

		file.data.fm = file.data.fm ?? {};
		file.data.fm.readingTime = `${minutes} min read`;
	};
}
