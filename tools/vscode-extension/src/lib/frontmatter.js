'use strict';

/**
 * Frontmatter as the site reads it — scalars, booleans and block sequences —
 * kept with line and column numbers so a diagnostic can point at the value that
 * is wrong rather than at the whole block.
 *
 * This is deliberately not a YAML parser. It understands exactly the shapes the
 * content tree uses, and reports anything else as a plain string.
 */

/** @param {string} value */
function unquote(value) {
	if (value.length < 2) return value;
	const first = value[0];
	const last = value[value.length - 1];
	if ((first === "'" && last === "'") || (first === '"' && last === '"')) return value.slice(1, -1);
	return value;
}

/** @param {string} value */
function scalar(value) {
	if (value === 'true') return true;
	if (value === 'false') return false;

	const inline = /^\[(.*)\]$/.exec(value);
	if (inline) {
		const inner = inline[1].trim();
		return inner ? inner.split(',').map((part) => unquote(part.trim())) : [];
	}

	return unquote(value);
}

/**
 * @typedef {Object} Field
 * @property {string} key
 * @property {string | boolean | string[]} value
 * @property {string} raw       the text after the colon, untouched
 * @property {number} line      absolute line number in the document
 * @property {number} column    column of the raw value
 */

/**
 * @param {string} body        text between the `---` delimiters
 * @param {number} startLine   document line the body starts on
 * @returns {Map<string, Field>}
 */
function parseFields(body, startLine = 1) {
	/** @type {Map<string, Field>} */
	const fields = new Map();
	const lines = body.split('\n');

	/** @type {Field | null} */
	let sequence = null;

	for (let i = 0; i < lines.length; i += 1) {
		const line = lines[i].replace(/\r$/, '');
		const item = /^\s+-\s+(.*)$/.exec(line);

		if (item && sequence) {
			/** @type {string[]} */ (sequence.value).push(unquote(item[1].trim()));
			continue;
		}
		sequence = null;

		if (!line.trim() || line.trimStart().startsWith('#')) continue;

		const colon = line.indexOf(':');
		if (colon === -1) continue;

		const key = line.slice(0, colon).trim();
		if (!key || /\s/.test(key)) continue;

		const raw = line.slice(colon + 1).trim();
		const field = {
			key,
			value: raw === '' ? [] : scalar(raw),
			raw,
			line: startLine + i,
			column: raw ? line.indexOf(raw, colon + 1) : colon + 1
		};

		fields.set(key, field);
		if (raw === '') sequence = field;
	}

	return fields;
}

/** Keys every entry of a kind needs before it can render. */
const REQUIRED = {
	blog: ['type', 'title', 'slug', 'description', 'date', 'published'],
	projects: ['title', 'description', 'year', 'published']
};

/** @param {string} kind */
function requiredKeys(kind) {
	return REQUIRED[kind] ?? ['title', 'description', 'published'];
}

/** YAML-quote a value that would otherwise change meaning or break the line. */
function quote(value) {
	if (typeof value === 'boolean') return String(value);
	const text = String(value);
	if (text === '') return "''";
	// Anything starting with a digit is a date or a number to YAML, never a
	// string — `date: 2024-07-16` and `year: 2022` both change type unquoted.
	if (/^[A-Za-z][\w .,!?()'/-]*$/u.test(text) && !/^(?:true|false|null|yes|no)$/i.test(text)) {
		return text.includes("'") ? `"${text}"` : text;
	}
	return text.includes("'") ? `"${text.replace(/"/g, '\\"')}"` : `'${text}'`;
}

/**
 * Render a frontmatter block, keeping the order it is given.
 *
 * @param {Array<[string, string | boolean | string[]]>} entries
 */
function stringifyFrontmatter(entries) {
	const lines = ['---'];
	for (const [key, value] of entries) {
		if (Array.isArray(value)) {
			lines.push(`${key}:`);
			for (const item of value) lines.push(`  - ${item}`);
			continue;
		}
		lines.push(`${key}: ${quote(value)}`);
	}
	lines.push('---');
	return lines.join('\n');
}

module.exports = { parseFields, quote, requiredKeys, stringifyFrontmatter };
