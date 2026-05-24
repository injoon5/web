import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { loadFonts } from './fonts.js';

const WIDTH = 1200;
const HEIGHT = 630;

/**
 * Render a satori element tree to a PNG buffer.
 * @param {object} element  satori-compatible React element tree
 * @returns {Promise<Buffer>}
 */
export async function renderOgImage(element) {
	const fonts = await loadFonts();

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
