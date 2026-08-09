/**
 * Stamp every local image in a post with the size it will actually be.
 *
 * A markdown `![alt](/images/x.jpeg)` compiles to a bare `<img src>`, which has
 * no intrinsic size until its bytes arrive: the paragraph after it sits directly
 * under the one before it, and then jumps down by the height of a photo. The
 * `width`/`height` attributes are what give the box an aspect ratio before the
 * first byte, and the article's `max-width`/`max-height` rules scale that box
 * exactly the way they will scale the loaded image — so the space held open is
 * the space the photo takes, to the pixel.
 *
 * It also stamps `data-img-pending`, which is what puts a placeholder in that
 * box (see `app.css`), and `loading`/`decoding`. Those two were being set from
 * `lazyImagesAction` after hydration, which is several hundred milliseconds
 * after the browser has already decided what to fetch.
 *
 * The size is read once per file per build, from the header — see
 * `image-size.js`. A file that cannot be read, or is in a format the probe does
 * not know, is left exactly as it was: a missing box is better than a wrong one.
 *
 * Runs before `remarkGallery`, which lifts `data.imageSize` off the nodes it
 * consumes so a gallery slide can reserve its box too.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { imageSize } from './image-size.js';

/** Resolved path -> size, or null for one already found unreadable. */
const cache = new Map();

/**
 * Only root-relative URLs into the static directory. A remote image is somebody
 * else's file and cannot be measured here; `../` would climb out of `static/`.
 *
 * @param {string} url
 * @param {string} root
 */
function resolveLocal(url, root) {
	if (!url || !url.startsWith('/') || url.startsWith('//')) return null;
	const clean = url.split(/[?#]/)[0];
	const file = path.join(root, decodeURIComponent(clean));
	const within = path.relative(root, file);
	if (within.startsWith('..') || path.isAbsolute(within)) return null;
	return file;
}

/**
 * @param {string} url
 * @param {string} root
 * @returns {{ width: number, height: number } | null}
 */
export function sizeOfLocalImage(url, root) {
	const file = resolveLocal(url, root);
	if (!file) return null;
	if (cache.has(file)) return cache.get(file);
	let size = null;
	try {
		size = imageSize(readFileSync(file));
	} catch {
		// Not there, or not readable. The image keeps whatever it had.
	}
	cache.set(file, size);
	return size;
}

/** @param {any} node @param {(image: any) => void} fn */
function visitImages(node, fn) {
	if (!node || typeof node !== 'object') return;
	if (node.type === 'image') fn(node);
	for (const child of node.children ?? []) visitImages(child, fn);
}

/**
 * @param {{ root?: string }} [options] `root` is the directory `/`-rooted image
 *   URLs resolve against — SvelteKit's `static/`.
 */
export function remarkImageSize(options = {}) {
	const root = options.root ?? path.join(process.cwd(), 'static');

	return function transformer(tree) {
		visitImages(tree, (node) => {
			const size = sizeOfLocalImage(node.url, root);
			if (!size) return;
			node.data ??= {};
			// Read back by `remarkGallery` for the images it turns into slides.
			node.data.imageSize = size;
			node.data.hProperties = {
				...node.data.hProperties,
				width: size.width,
				height: size.height,
				// The same two numbers again, where CSS can reach them. The article
				// sizes images with `width: auto`, which is what lets a tall photo
				// shrink when it hits `max-height` — and which also means the browser
				// gives an image it has not fetched a box of 0x0, attributes or no
				// attributes. `app.css` computes the real box from these while the
				// placeholder is up. `attr()` would do instead, but only in Chrome.
				style: `--img-w: ${size.width}; --img-h: ${size.height}`,
				loading: 'lazy',
				decoding: 'async',
				// Cleared by the first `load`. Server-rendered rather than added on
				// hydration, so the placeholder is there in the first paint — which is
				// the only paint it exists for.
				'data-img-pending': 'true'
			};
		});
	};
}

export default remarkImageSize;
