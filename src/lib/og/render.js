import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { loadFonts } from './fonts.js';
import { WIDTH, HEIGHT } from './templates.js';

/**
 * Render a satori element tree to a PNG buffer.
 * @param {object} element  satori-compatible React element tree
 * @param {string} origin  Absolute origin used to fetch the OG fonts
 * @returns {Promise<Buffer>}
 */
export async function renderOgImage(element, origin) {
	const fonts = await loadFonts(origin);

	const svg = await satori(element, {
		width: WIDTH,
		height: HEIGHT,
		fonts
	});

	const resvg = new Resvg(svg, {
		fitTo: { mode: 'width', value: WIDTH }
	});

	return resvg.render().asPng();
}
