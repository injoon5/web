/**
 * Turn a video written in markdown into a `<LazyVideo />`.
 *
 * `![Play the demo](/videos/x.mp4)` compiles to an `<img src="/videos/x.mp4">`,
 * which shows a broken image; `[Play the demo](/videos/x.mp4)` compiles to a
 * link that navigates away from the article to the browser's bare player. The
 * component that already exists for this — a poster frame with a play button,
 * and `preload="none"` so the file is not fetched until someone asks for it —
 * had to be imported and written out by hand in the file's own `<script>`, which
 * is why exactly two posts use it.
 *
 * The rule is deliberately narrow: **a top-level paragraph that is nothing but
 * one video reference**. A video is written on its own line, and anything less
 * strict would have to decide what a video does in the middle of a sentence.
 * Mixed content is left exactly as the author wrote it.
 *
 * Runs before `remarkGallery`, which would otherwise collect a video's `image`
 * node into a photo strip.
 *
 * The label is the alt text or the link text, and the title attribute beats
 * both — the same order `remarkGallery` reads a caption in. With none of them
 * the component's own default is left to apply.
 *
 * A local MP4 is measured out of its headers and the size passed along, so the
 * poster and the player take the clip's own shape before a byte of it loads —
 * the frame was a fixed 16:9, which played a portrait watch recording cropped
 * to its top half.
 */

import path from 'node:path';
import { resolveLocal } from './remark-image-size.js';
import { addComponentImport } from './splice-import.js';
import { sizeOfVideoFile } from './video-size.js';

const LAZY_VIDEO = { name: 'LazyVideo', path: '#lib/ui/LazyVideo.svelte' };

/** Container formats a `<video>` element can actually play. */
const VIDEO_FILE = /\.(mp4|m4v|webm|mov|ogv)(?:[?#].*)?$/i;

/** @param {string | null | undefined} url */
export function isVideoUrl(url) {
	return Boolean(url && VIDEO_FILE.test(url));
}

/** @param {any} node */
function textOf(node) {
	if (!node) return '';
	if (node.type === 'text') return node.value;
	return (node.children ?? []).map(textOf).join('');
}

/**
 * The one video this paragraph is, or null if it is anything else.
 *
 * Whitespace is skipped because a line break between the marker and the end of
 * the paragraph is still one text node in mdast.
 *
 * @param {{ children: any[] }} paragraph
 * @returns {{ src: string, label: string } | null}
 */
function loneVideo(paragraph) {
	let found = null;
	for (const child of paragraph.children) {
		if (child.type === 'text' && child.value.trim() === '') continue;
		if (child.type === 'break') continue;
		// An image is `![alt](url)`, a link is `[text](url)`. Both are how someone
		// writes "here is a video" without knowing which one this site wanted.
		const isRef = child.type === 'image' || child.type === 'link';
		if (!isRef || !isVideoUrl(child.url) || found) return null;
		const label = child.title || (child.type === 'image' ? child.alt : textOf(child)) || '';
		found = { src: child.url, label: label.trim() };
	}
	return found;
}

/**
 * @param {string} src
 * @param {string} root
 * @returns {{ width: number, height: number } | null}
 */
function measure(src, root) {
	const file = resolveLocal(src, root);
	if (!file) return null;
	try {
		return sizeOfVideoFile(file);
	} catch {
		// Not there, or not readable: the component's 16:9 fallback applies.
		return null;
	}
}

/**
 * @param {{ src: string, label: string }} video
 * @param {{ width: number, height: number } | null} size
 */
function videoNode({ src, label }, size) {
	const props = [`src={${JSON.stringify(src)}}`];
	// No label means the component's own default, rather than an empty one.
	if (label) props.push(`label={${JSON.stringify(label)}}`);
	if (size) props.push(`width={${size.width}}`, `height={${size.height}}`);
	return { type: 'html', value: `<${LAZY_VIDEO.name} ${props.join(' ')} />` };
}

/** @param {{ root?: string }} [options] `root` is the directory `/`-rooted URLs resolve in */
export function remarkLazyVideo(options = {}) {
	const root = options.root ?? path.join(process.cwd(), 'static');
	return function transformer(tree) {
		let found = false;

		tree.children = tree.children.map((node) => {
			if (node.type !== 'paragraph') return node;
			const video = loneVideo(node);
			if (!video) return node;
			found = true;
			return videoNode(video, measure(video.src, root));
		});

		if (found) addComponentImport(tree, LAZY_VIDEO);
	};
}

export default remarkLazyVideo;
