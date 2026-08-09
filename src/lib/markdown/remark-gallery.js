/**
 * Turn images in markdown into a `<Gallery />`.
 *
 * Implicit form: a top-level paragraph that is nothing but images. Consecutive
 * lines are one paragraph in mdast, so the run is one the author already grouped
 * by hand. A blank line between images makes them separate paragraphs, and is
 * the escape hatch.
 *
 * Explicit form: a `:::gallery` ... `:::` fence, which groups however the images
 * are spaced — including a single image. Three rules keep a typo from eating a
 * post: only images are collected (anything else is re-emitted after the
 * gallery), an unclosed fence transforms nothing, and a fence with no images
 * transforms nothing.
 *
 * The component reaches the compiled markdown through an import in the file's
 * instance `<script>`, the same way a hand-written `<LazyVideo />` does. mdsvex
 * performs this same splice for its own layout import.
 */

import { addComponentImport } from './splice-import.js';

const GALLERY = { name: 'Gallery', path: '$lib/lightbox/Gallery.svelte' };

const FENCE_OPEN = /^:::\s*gallery\s*$/;
const FENCE_CLOSE = /^:::\s*$/;

/** @param {any} node */
function toImage(node) {
	// `remarkImageSize` ran first and measured the file. A slide that knows the
	// aspect ratio can hold the photo's box open before a byte of it arrives.
	const size = node.data?.imageSize;
	return {
		src: node.url,
		alt: node.alt ?? '',
		...(node.title ? { title: node.title } : {}),
		...(size ? { width: size.width, height: size.height } : {})
	};
}

/**
 * Images and nothing else — whitespace between them is the line breaks that
 * put them in one paragraph in the first place.
 *
 * @param {{ children: any[] }} paragraph
 * @param {number} minImages
 * @returns {Array<{ src: string, alt: string, title?: string }> | null}
 */
function imagesOnly(paragraph, minImages) {
	const images = [];
	for (const child of paragraph.children) {
		if (child.type === 'image') {
			images.push(toImage(child));
			continue;
		}
		if (child.type === 'text' && child.value.trim() === '') continue;
		if (child.type === 'break') continue;
		return null;
	}
	return images.length >= minImages ? images : null;
}

/**
 * Read a paragraph as a stream of fence markers, images and everything else.
 *
 * The markers get no node of their own: `:::gallery` on the line above an image
 * is the *same* paragraph as that image, with the line break inside a text node.
 * So they are found inside the text, and a paragraph is rebuilt from what is
 * left once they are taken out.
 *
 * @param {{ children: any[] }} paragraph
 * @returns {Array<{ kind: 'open' | 'close' | 'image' | 'other', node?: any, image?: any }>}
 */
function tokenize(paragraph) {
	const tokens = [];
	for (const child of paragraph.children) {
		if (child.type === 'image') {
			tokens.push({ kind: 'image', image: toImage(child), node: child });
			continue;
		}
		if (child.type !== 'text') {
			tokens.push({ kind: 'other', node: child });
			continue;
		}
		let buffer = [];
		const flush = () => {
			const value = buffer.join('\n');
			if (value.trim() !== '') tokens.push({ kind: 'other', node: { type: 'text', value } });
			buffer = [];
		};
		for (const line of child.value.split('\n')) {
			const trimmed = line.trim();
			if (FENCE_OPEN.test(trimmed)) {
				flush();
				tokens.push({ kind: 'open' });
				continue;
			}
			if (FENCE_CLOSE.test(trimmed)) {
				flush();
				tokens.push({ kind: 'close' });
				continue;
			}
			buffer.push(line);
		}
		flush();
	}
	return tokens;
}

/** Non-marker tokens back into a paragraph, or nothing when only markers were there. */
function toParagraph(tokens) {
	const children = tokens.filter((t) => t.kind !== 'open' && t.kind !== 'close').map((t) => t.node);
	return children.length ? { type: 'paragraph', children } : null;
}

/** @param {Array<{ src: string, alt: string, title?: string }>} images */
function galleryNode(images) {
	return { type: 'html', value: `<Gallery images={${JSON.stringify(images)}} />` };
}

/**
 * @param {{ minImages?: number }} [options]
 */
export function remarkGallery(options = {}) {
	const minImages = options.minImages ?? 2;

	return function transformer(tree) {
		/** @type {any[]} */
		const out = [];
		let found = false;

		// Open-fence bookkeeping. `fenceOriginal` is the untouched slice of the
		// document the fence covers, kept so an unclosed or empty fence can be put
		// back exactly as the author wrote it.
		let fenceOpen = false;
		/** @type {Array<{ src: string, alt: string, title?: string }>} */
		let fenceImages = [];
		/** @type {any[]} */
		let fenceKept = [];
		/** @type {any[]} */
		let fenceOriginal = [];

		function abandonFence() {
			out.push(...fenceOriginal);
			fenceOpen = false;
			fenceImages = [];
			fenceKept = [];
			fenceOriginal = [];
		}

		function closeFence() {
			if (fenceImages.length === 0) {
				abandonFence();
				return;
			}
			out.push(galleryNode(fenceImages));
			out.push(...fenceKept);
			found = true;
			fenceOpen = false;
			fenceImages = [];
			fenceKept = [];
			fenceOriginal = [];
		}

		// Top-level only. An image run inside a blockquote or a list item is
		// carrying that block's meaning, and a scroll strip would lose it.
		for (const node of tree.children) {
			if (node.type !== 'paragraph') {
				if (fenceOpen) {
					fenceOriginal.push(node);
					fenceKept.push(node);
				} else {
					out.push(node);
				}
				continue;
			}

			const tokens = tokenize(node);
			const hasMarker = tokens.some((t) => t.kind === 'open' || t.kind === 'close');

			if (!fenceOpen && !hasMarker) {
				const images = imagesOnly(node, minImages);
				if (images) {
					out.push(galleryNode(images));
					found = true;
				} else {
					out.push(node);
				}
				continue;
			}

			if (fenceOpen) fenceOriginal.push(node);

			// Walk the paragraph's tokens, splitting it at each marker.
			let segment = [];
			for (const token of tokens) {
				if (token.kind === 'open') {
					if (fenceOpen) {
						// A second `:::gallery` inside one is not a nesting we support —
						// treat it as content so the mistake stays visible.
						segment.push({ kind: 'other', node: { type: 'text', value: ':::gallery' } });
						continue;
					}
					const before = toParagraph(segment);
					if (before) out.push(before);
					segment = [];
					fenceOpen = true;
					fenceOriginal = [node];
					continue;
				}
				if (token.kind === 'close') {
					if (!fenceOpen) {
						segment.push({ kind: 'other', node: { type: 'text', value: ':::' } });
						continue;
					}
					const inside = toParagraph(segment);
					if (inside) fenceKept.push(inside);
					segment = [];
					closeFence();
					continue;
				}
				if (fenceOpen && token.kind === 'image') {
					fenceImages.push(token.image);
					continue;
				}
				segment.push(token);
			}

			const rest = toParagraph(segment);
			if (!rest) continue;
			if (fenceOpen) fenceKept.push(rest);
			else out.push(rest);
		}

		// A fence the author never closed transforms nothing: the markers stay as
		// literal text, which is a mistake they can see rather than a document
		// whose every remaining image quietly joined one gallery.
		if (fenceOpen) abandonFence();

		tree.children = out;
		if (found) addComponentImport(tree, GALLERY);
	};
}

export default remarkGallery;
