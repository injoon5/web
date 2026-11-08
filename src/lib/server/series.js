// @ts-check
import { DATE_FIELD } from './catalogue.js';

/** @typedef {import('./catalogue.js').Article} Article */
/** @typedef {{ slug: string, title?: unknown, date?: unknown, series?: unknown }} SeriesEntry */
/** @typedef {{ en: SeriesEntry[], ko: SeriesEntry[] }} Series */

/**
 * Each post's series, in each language, newest first — each entry the post's
 * own record in that language, or its other language's when it has only one —
 * keyed by slug. A post in no series has no key.
 *
 * Computed on the server (prerendered into `/api/articles.json`) and not in the
 * page's universal load: that load also imports the post components lazily, and
 * a module imported both ways cannot be split, so the eager metadata glob this
 * used to read there put every post's compiled component into one chunk that
 * every article page loaded.
 *
 * @param {Article[]} posts  newest first, as the catalogue lists them
 * @returns {Record<string, Series>}
 */
export function seriesBySlug(posts) {
	/** @type {(post: Article, lang: string) => SeriesEntry} */
	const entry = (post, lang) => {
		const { title, series, [DATE_FIELD.blog]: date } = post.meta[lang] ?? post.meta[post.langs[0]];
		return { slug: post.slug, title, date, series };
	};

	/** @type {Map<unknown, Series>} */
	const byName = new Map();
	for (const post of posts) {
		const name = post.meta.en?.series ?? post.meta.ko?.series;
		if (!name) continue;
		const series = byName.get(name) ?? { en: [], ko: [] };
		series.en.push(entry(post, 'en'));
		series.ko.push(entry(post, 'ko'));
		byName.set(name, series);
	}

	/** @type {Record<string, Series>} */
	const out = {};
	for (const series of byName.values()) {
		for (const { slug } of series.en) out[slug] = series;
	}
	return out;
}
