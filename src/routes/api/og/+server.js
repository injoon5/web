import { renderOgImage } from '#lib/og/render.js';
import { buildOgElement, resolveOgInput } from '#lib/og/build.js';
import { OG_FIXTURES } from '#lib/og/fixtures.js';

const ONE_DAY = 60 * 60 * 24;
const ONE_WEEK = ONE_DAY * 7;

/** @type {import('./$types').RequestHandler} */
export async function GET({ url }) {
	// `?fixture=` is the preview gallery's (/api/og/test), and gone in production.
	const fixture = __DIALS__ ? OG_FIXTURES[url.searchParams.get('fixture') ?? ''] : undefined;
	const png = await renderOgImage(
		buildOgElement(fixture ?? resolveOgInput(url.searchParams)),
		url.origin
	);

	return new Response(png, {
		headers: {
			'Content-Type': 'image/png',
			'Cache-Control': fixture
				? 'no-store'
				: `public, max-age=${ONE_DAY}, s-maxage=${ONE_WEEK}, stale-while-revalidate=${ONE_DAY}`
		}
	});
}
