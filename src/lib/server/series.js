// @ts-check
import { slugFromPath } from '#lib/content/bilingual.js';

/** @typedef {Record<string, unknown> & { slug: string, series?: string, date?: string }} Metadata */
/** @typedef {{ slug: string, title?: unknown, date?: unknown, series?: unknown }} SeriesEntry */

/**
 * @param {Record<string, unknown>} metaByPath
 * @returns {Map<string, Metadata>} published metadata by slug, slug included
 */
function publishedBySlug(metaByPath) {
	/** @type {Map<string, Metadata>} */
	const bySlug = new Map();
	for (const path in metaByPath) {
		const meta = /** @type {Record<string, unknown> | undefined} */ (metaByPath[path]);
		if (meta?.published !== true) continue;
		const slug = slugFromPath(path);
		bySlug.set(slug, { ...meta, slug });
	}
	return bySlug;
}

/**
 * The series a post belongs to, in each language, newest first — each entry the
 * post's own record in that language, or its other language's when it has only
 * one. Both lists are empty for a post in no series.
 *
 * Computed on the server (prerendered into `/api/series.json`) and not in the
 * page's universal load: that load also imports the post components lazily, and
 * a module imported both ways cannot be split, so the eager metadata glob this
 * used to read there put every post's compiled component into one chunk that
 * every article page loaded.
 *
 * @param {string} slug
 * @param {Record<string, unknown>} enPaths an eager `import: 'metadata'` glob
 * @param {Record<string, unknown>} koPaths
 * @returns {{ enSeries: Metadata[], koSeries: Metadata[] }}
 */
export function postSeries(slug, enPaths, koPaths) {
	const en = publishedBySlug(enPaths);
	const ko = publishedBySlug(koPaths);
	const names = new Set([en.get(slug)?.series, ko.get(slug)?.series].filter(Boolean));
	if (names.size === 0) return { enSeries: [], koSeries: [] };

	/** @type {{ eMeta: Metadata | null, kMeta: Metadata | null }[]} */
	const matched = [];
	for (const s of new Set([...en.keys(), ...ko.keys()])) {
		const eMeta = en.get(s) ?? null;
		const kMeta = ko.get(s) ?? null;
		if (names.has(eMeta?.series ?? kMeta?.series)) matched.push({ eMeta, kMeta });
	}

	/** @param {Metadata | null} m */
	const dateOf = (m) => (m?.date ? new Date(m.date).getTime() : 0);
	matched.sort((a, b) => dateOf(b.eMeta ?? b.kMeta) - dateOf(a.eMeta ?? a.kMeta));

	return {
		enSeries: matched.map(({ eMeta, kMeta }) => /** @type {Metadata} */ (eMeta ?? kMeta)),
		koSeries: matched.map(({ eMeta, kMeta }) => /** @type {Metadata} */ (kMeta ?? eMeta))
	};
}

/** @param {Metadata} m @returns {SeriesEntry} */
const seriesEntry = ({ slug, title, date, series }) => ({ slug, title, date, series });

/**
 * `postSeries` for every published post that is in a series, keyed by slug and
 * cut down to what `SeriesList` draws. A post in no series has no key.
 *
 * @param {Record<string, unknown>} enPaths an eager `import: 'metadata'` glob
 * @param {Record<string, unknown>} koPaths
 * @returns {Record<string, { enSeries: SeriesEntry[], koSeries: SeriesEntry[] }>}
 */
export function allPostSeries(enPaths, koPaths) {
	const slugs = new Set([...publishedBySlug(enPaths).keys(), ...publishedBySlug(koPaths).keys()]);
	/** @type {Record<string, { enSeries: SeriesEntry[], koSeries: SeriesEntry[] }>} */
	const out = {};
	for (const slug of [...slugs].sort()) {
		const { enSeries, koSeries } = postSeries(slug, enPaths, koPaths);
		if (enSeries.length === 0) continue;
		out[slug] = { enSeries: enSeries.map(seriesEntry), koSeries: koSeries.map(seriesEntry) };
	}
	return out;
}
