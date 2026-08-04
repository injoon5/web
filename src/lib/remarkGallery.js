/**
 * Turn a paragraph that is nothing but images into a `<Gallery />`.
 *
 * The trigger is markdown an author would already have written:
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
			images.push({
				src: child.url,
				alt: child.alt ?? '',
				...(child.title ? { title: child.title } : {})
			});
			continue;
		}
		if (child.type === 'text' && child.value.trim() === '') continue;
		if (child.type === 'break') continue;
		return null;
	}
	return images.length >= minImages ? images : null;
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
		let found = false;

		// Top-level only. An image run inside a blockquote or a list item is
		// carrying that block's meaning, and a scroll strip would lose it.
		for (let i = 0; i < tree.children.length; i++) {
			const node = tree.children[i];
			if (node.type !== 'paragraph') continue;

			const images = imagesOnly(node, minImages);
			if (!images) continue;

			tree.children[i] = {
				type: 'html',
				value: `<Gallery images={${JSON.stringify(images)}} />`
			};
			found = true;
		}

		if (found) addImport(tree);
	};
}

export default remarkGallery;
