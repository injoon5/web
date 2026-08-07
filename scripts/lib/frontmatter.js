/** Parse a single YAML-like frontmatter line into [key, value]. */
function parseFrontmatterLine(line) {
	const idx = line.indexOf(':');
	if (idx === -1) return null;

	const key = line.slice(0, idx).trim();
	let value = line.slice(idx + 1).trim();
	if (!key) return null;

	value = unquoteYamlValue(value);
	return [key, parseYamlScalar(value)];
}

function unquoteYamlValue(value) {
	if (value.length < 2) return value;

	const first = value[0];
	const last = value[value.length - 1];
	if ((first === "'" && last === "'") || (first === '"' && last === '"')) {
		return value.slice(1, -1);
	}

	return value;
}

function parseYamlScalar(value) {
	if (value === 'true') return true;
	if (value === 'false') return false;

	const arrayMatch = /^\[(.*)\]$/.exec(value);
	if (arrayMatch) {
		const inner = arrayMatch[1].trim();
		if (!inner) return [];
		return inner.split(',').map((part) => unquoteYamlValue(part.trim()));
	}

	return value;
}

/** Parse simple YAML frontmatter (scalars, booleans, inline arrays). */
export function parseFrontmatter(text) {
	const meta = {};
	for (const line of text.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;

		const parsed = parseFrontmatterLine(trimmed);
		if (parsed) meta[parsed[0]] = parsed[1];
	}
	return meta;
}
