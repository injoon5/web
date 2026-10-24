import { load as contentLoad } from '#lib/server/content-page.js';
import { blogEnMeta, blogKoMeta } from '#lib/server/content-modules.js';
import { postSeries } from '#lib/server/series.js';

/** @param {Parameters<typeof contentLoad>[0] & { params: { slug: string } }} event */
export function load(event) {
	return { ...contentLoad(event), ...postSeries(event.params.slug, blogEnMeta, blogKoMeta) };
}
