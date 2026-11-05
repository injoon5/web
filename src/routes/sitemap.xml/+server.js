export const prerender = true;

import { create } from 'xmlbuilder2';
import {
	blogEnMeta,
	blogKoMeta,
	projectEnMeta,
	projectKoMeta
} from '#lib/server/content-modules.js';
import { SITE_URL, languageUrls, sitemapEntries } from '#lib/server/sitemap.js';

export const GET = async () => {
	const entries = sitemapEntries({ blogEnMeta, blogKoMeta, projectEnMeta, projectKoMeta });

	// The xhtml namespace carries the per-URL hreflang alternates, so bilingual
	// posts declare both languages the same way the pages do in their <head>.
	const urlset = create({ version: '1.0', encoding: 'UTF-8' }).ele('urlset', {
		xmlns: 'http://www.sitemaps.org/schemas/sitemap/0.9',
		'xmlns:xhtml': 'http://www.w3.org/1999/xhtml'
	});

	for (const entry of entries) {
		for (const { loc, alternates } of languageUrls(entry)) {
			const url = urlset.ele('url');
			url.ele('loc').txt(`${SITE_URL}${loc}`).up();
			if (entry.lastmod) url.ele('lastmod').txt(entry.lastmod).up();
			if (entry.priority) url.ele('priority').txt(entry.priority).up();
			for (const { hreflang, path } of alternates) {
				url.ele('xhtml:link', { rel: 'alternate', hreflang, href: `${SITE_URL}${path}` }).up();
			}
		}
	}

	const xml = urlset.end({ prettyPrint: true });

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/xml; charset=UTF-8'
		}
	});
};
