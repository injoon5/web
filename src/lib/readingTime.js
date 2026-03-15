// English: ~200 WPM (word-based)
// Korean: ~500 CPM — characters per minute (eojeol-based reading is faster measured in chars)
const EN_WORDS_PER_MINUTE = 200;
const KO_CHARS_PER_MINUTE = 500;

/**
 * Strip markdown syntax from raw text, leaving plain readable content.
 * @param {string} markdown
 * @returns {string}
 */
function stripMarkdown(markdown) {
	let text = markdown.replace(/^---[\s\S]*?---\s*\n/, '');  // YAML frontmatter
	text = text.replace(/```[\s\S]*?```/g, '');               // fenced code blocks
	text = text.replace(/`[^`]+`/g, '');                      // inline code
	text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, '');         // images
	text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');      // links → label
	text = text.replace(/^#{1,6}\s+/gm, '');                  // heading markers
	text = text.replace(/[*_~]+/g, '');                       // bold/italic/strikethrough
	text = text.replace(/<[^>]+>/g, '');                      // HTML tags
	return text.trim();
}

/**
 * Calculate estimated reading time from raw markdown, using language-appropriate speed.
 * @param {string} markdown - Raw markdown content
 * @param {'en' | 'ko'} lang - Language of the content
 * @returns {string} e.g. "3 min read"
 */
export function readingTime(markdown, lang = 'en') {
	const text = stripMarkdown(markdown);

	let minutes;
	if (lang === 'ko') {
		// Korean: count non-whitespace characters (excludes spaces between eojeol)
		const chars = text.replace(/\s+/g, '').length;
		minutes = Math.max(1, Math.ceil(chars / KO_CHARS_PER_MINUTE));
	} else {
		const words = text.split(/\s+/).filter(Boolean).length;
		minutes = Math.max(1, Math.ceil(words / EN_WORDS_PER_MINUTE));
	}

	return `${minutes} min read`;
}
