export const prerender = true;

import { create } from 'xmlbuilder2';
import {
	blogEnMeta,
	blogKoMeta,
	projectEnMeta,
	projectKoMeta
} from '$lib/server/content-modules.js';
import { SITE_URL, sitemapEntries } from '$lib/server/sitemap.js';

export const GET = async () => {
	const entries = sitemapEntries({ blogEnMeta, blogKoMeta, projectEnMeta, projectKoMeta });

	// The xhtml namespace carries the per-URL hreflang alternates, so bilingual
	// posts declare both languages the same way the pages do in their <head>.
	const urlset = create({ version: '1.0', encoding: 'UTF-8' }).ele('urlset', {
		xmlns: 'http://www.sitemaps.org/schemas/sitemap/0.9',
		'xmlns:xhtml': 'http://www.w3.org/1999/xhtml'
	});

	for (const entry of entries) {
		const url = urlset.ele('url');
		url.ele('loc').txt(`${SITE_URL}${entry.path}`).up();
		if (entry.lastmod) url.ele('lastmod').txt(entry.lastmod).up();
		if (entry.priority) url.ele('priority').txt(entry.priority).up();

		// Alternates are only meaningful when a slug exists in more than one
		// language; a single-language post just points at itself.
		if (entry.langs && entry.langs.length > 1) {
			for (const lang of entry.langs) {
				url
					.ele('xhtml:link', {
						rel: 'alternate',
						hreflang: lang,
						href: `${SITE_URL}${entry.path}?lang=${lang}`
					})
					.up();
			}
			url
				.ele('xhtml:link', {
					rel: 'alternate',
					hreflang: 'x-default',
					href: `${SITE_URL}${entry.path}`
				})
				.up();
		}
	}

	const xml = urlset.end({ prettyPrint: true });

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/xml; charset=UTF-8'
		}
	});
};
