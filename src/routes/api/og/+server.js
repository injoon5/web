import { renderOgImage } from '$lib/og/render.js';
import { buildOgElement, resolveOgInput } from '$lib/og/build.js';

const ONE_DAY = 60 * 60 * 24;
const ONE_WEEK = ONE_DAY * 7;

/** @type {import('./$types').RequestHandler} */
export async function GET({ url }) {
	const input = resolveOgInput(url.searchParams);
	const element = buildOgElement(input);
	const png = await renderOgImage(element, url.origin);

	const isFixture = url.searchParams.has('fixture');

	return new Response(png, {
		headers: {
			'Content-Type': 'image/png',
			'Cache-Control': isFixture
				? 'no-store'
				: `public, max-age=${ONE_DAY}, s-maxage=${ONE_WEEK}, stale-while-revalidate=${ONE_DAY}`
		}
	});
}
