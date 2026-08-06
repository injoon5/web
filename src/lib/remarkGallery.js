/**
 * Turn images in markdown into a `<Gallery />`.
 *
 * There are two ways in. The first is implicit — a paragraph that is nothing
 * but images:
 *
 * ```md
 * ![Snowflake](/one.png)
 * ![Framer](/two.png)
 * ![Vercel](/three.png)
 * ```
 *
 * Three images on consecutive lines are one paragraph in mdast, so this is a
 * run the author has already grouped by hand — it just used to render as three
 * full-width photos in a column. Images separated by a blank line are separate
 * paragraphs and are left alone, which is the escape hatch: put a blank line
 * between them and they stay stacked.
 *
 * The second is explicit, and is what that escape hatch costs you back:
 *
 * ```md
 * :::gallery
 * ![One](/one.png)
 *
 * ![Two](/two.png "A caption")
 * :::
 * ```
 *
 * Everything between the fences becomes one gallery however the images are
 * spaced, so a run written with blank lines between it — or one image, or a
 * hundred — can still be a gallery. The rules around it:
 *
 * - **Only images are collected.** Anything else inside the fence (a
 *   paragraph of prose, a heading) is kept and re-emitted after the gallery
 *   rather than silently dropped.
 * - **An unclosed fence transforms nothing.** The `:::gallery` line is left as
 *   the literal text the author typed, so the mistake is visible in the post
 *   instead of swallowing every image to the end of the file.
 * - **A fence with no images transforms nothing** either, for the same reason.
 * - Top-level only, like the implicit form.
 *
 * The component reaches the compiled markdown the same way a hand-written
 * `<LazyVideo />` does — through an import in the file's instance `<script>`.
 * mdsvex hoists that script wherever it appears, and does exactly this splice
 * for its own layout import, so injecting into an author's existing script is
 * the supported shape rather than a trick.
 */

const GALLERY_PATH = '$lib/Gallery.svelte';
const GALLERY_IMPORT = `import Gallery from '${GALLERY_PATH}';`;

/** `<script>` / `<script lang="ts">`, but not `<script module>` or `context="module"`. */
const INSTANCE_SCRIPT = /^<script(?![^>]*\bmodule\b)[^>]*>/;

const FENCE_OPEN = /^:::\s*gallery\s*$/;
const FENCE_CLOSE = /^:::\s*$/;

/** @param {any} node */
function toImage(node) {
	return {
		src: node.url,
		alt: node.alt ?? '',
		...(node.title ? { title: node.title } : {})
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
 * The markers do not get a node of their own: `:::gallery` on the line above an
 * image is the *same* paragraph as that image, and remark keeps the line break
 * inside a text node. So the markers have to be found inside the text, and the
 * rest of that text has to survive — a paragraph is only reconstructed from
 * what is left once the markers are taken out.
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

/** @param {any} tree */
function addImport(tree) {
	const at = tree.children.findIndex(
		(node) => node.type === 'html' && INSTANCE_SCRIPT.test(node.value.trimStart())
	);

	if (at === -1) {
		tree.children.unshift({ type: 'html', value: `<script>\n\t${GALLERY_IMPORT}\n</script>` });
		return;
	}

	// An author who already imported it keeps their own import.
	if (tree.children[at].value.includes(GALLERY_PATH)) return;
	tree.children[at].value = tree.children[at].value.replace(
		INSTANCE_SCRIPT,
		(open) => `${open}\n\t${GALLERY_IMPORT}`
	);
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
		if (found) addImport(tree);
	};
}

export default remarkGallery;
