/**
 * Give a compiled markdown file an import it does not have.
 *
 * A remark plugin that emits a Svelte component has to get that component into
 * scope, and the only scope a `.md` file has is its instance `<script>`. mdsvex
 * performs this exact splice for its own layout import, which is what makes it
 * safe to do: the file is Svelte source by the time the compiler sees it.
 *
 * Shared by `remarkGallery` and `remarkLazyVideo` — the second one to want it is
 * what made it worth having in one place, since the interesting part is the
 * regexp and both getting it wrong the same way is the failure mode.
 */

/** `<script>` / `<script lang="ts">`, but not `<script module>` or `context="module"`. */
const INSTANCE_SCRIPT = /^<script(?![^>]*\bmodule\b)[^>]*>/;

/**
 * @param {any} tree mdast root
 * @param {{ name: string, path: string }} component
 */
export function addComponentImport(tree, { name, path }) {
	const statement = `import ${name} from '${path}';`;
	const at = tree.children.findIndex(
		(node) => node.type === 'html' && INSTANCE_SCRIPT.test(node.value.trimStart())
	);

	if (at === -1) {
		tree.children.unshift({ type: 'html', value: `<script>\n\t${statement}\n</script>` });
		return;
	}

	// An author who already imported it keeps their own import.
	if (tree.children[at].value.includes(path)) return;
	tree.children[at].value = tree.children[at].value.replace(
		INSTANCE_SCRIPT,
		(open) => `${open}\n\t${statement}`
	);
}
