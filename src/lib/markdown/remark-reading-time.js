import { toString } from 'mdast-util-to-string';
import { postLang } from './post-lang.js';

const EN_WORDS_PER_MINUTE = 200;
// Korean is counted in characters, without the spaces between words.
const KO_CHARS_PER_MINUTE = 500;

/**
 * Remark plugin that computes reading time at build time from the parsed AST
 * and injects it into the mdsvex frontmatter metadata as `readingMinutes`.
 */
export function remarkReadingTime() {
	return function (tree, file) {
		const text = toString(tree);
		const minutes =
			postLang(file) === 'ko'
				? text.replace(/\s+/g, '').length / KO_CHARS_PER_MINUTE
				: text.split(/\s+/).filter(Boolean).length / EN_WORDS_PER_MINUTE;

		file.data.fm = file.data.fm ?? {};
		file.data.fm.readingMinutes = Math.max(1, Math.ceil(minutes));
	};
}
