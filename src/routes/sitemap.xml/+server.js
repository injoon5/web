export const prerender = true;

import { create } from 'xmlbuilder2';
import { SITE_URL } from '#lib/content/article-paths.js';
import { catalogue } from '#lib/server/catalogue.js';
import { sitemapUrls } from '#lib/server/sitemap.js';

export const GET = async () => {
	// The xhtml namespace carries the per-URL hreflang alternates, so bilingual
	// posts declare both languages the same way the pages do in their <head>.
	const urlset = create({ version: '1.0', encoding: 'UTF-8' }).ele('urlset', {
		xmlns: 'http://www.sitemaps.org/schemas/sitemap/0.9',
		'xmlns:xhtml': 'http://www.w3.org/1999/xhtml'
	});

	for (const { loc, lastmod, priority, alternates } of sitemapUrls(catalogue)) {
		const url = urlset.ele('url');
		url.ele('loc').txt(`${SITE_URL}${loc}`).up();
		if (lastmod) url.ele('lastmod').txt(lastmod).up();
		if (priority) url.ele('priority').txt(priority).up();
		for (const { hreflang, path } of alternates) {
			url.ele('xhtml:link', { rel: 'alternate', hreflang, href: `${SITE_URL}${path}` }).up();
		}
	}

	return new Response(urlset.end({ prettyPrint: true }), {
		headers: { 'Content-Type': 'application/xml; charset=UTF-8' }
	});
};
