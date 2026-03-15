const WORDS_PER_MINUTE = 200;

/**
 * Calculate estimated reading time from raw markdown text.
 * Strips frontmatter, code blocks, and markdown syntax before counting words.
 * @param {string} markdown - Raw markdown content
 * @returns {string} e.g. "3 min read"
 */
export function readingTime(markdown) {
	// Remove YAML frontmatter
	let text = markdown.replace(/^---[\s\S]*?---\s*\n/, '');

	// Remove fenced code blocks
	text = text.replace(/```[\s\S]*?```/g, '');

	// Remove inline code
	text = text.replace(/`[^`]+`/g, '');

	// Remove images
	text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, '');

	// Replace links with their label text
	text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');

	// Remove heading markers
	text = text.replace(/^#{1,6}\s+/gm, '');

	// Remove bold/italic/strikethrough markers
	text = text.replace(/[*_~]+/g, '');

	// Remove HTML tags
	text = text.replace(/<[^>]+>/g, '');

	const words = text.trim().split(/\s+/).filter(Boolean).length;
	const minutes = Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
	return `${minutes} min read`;
}
