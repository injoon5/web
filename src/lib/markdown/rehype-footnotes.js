/**
 * Footnotes, finished.
 *
 * `remark-footnotes` 2 parses `[^label]` for the pre-micromark parser mdsvex
 * bundles, and mdsvex's own mdast-to-hast writes the markup. That markup is
 * from before anyone held footnotes to much: the marker shows the label
 * (`[^note]` renders a superscript "note"), a note cited twice puts two
 * elements on the page with the same `id`, the back link is a bare `↩`, which
 * iOS draws as an emoji, and nothing is labelled for a screen reader.
 *
 * So, after everything else has run:
 * - markers are numbered in reading order, which is the order the list is in;
 * - each citation gets its own id (`fnref-1`, `fnref-1-2`), and the note links
 *   back to every one of them;
 * - the list is a `<section>` labelled by a visually hidden heading, and each
 *   marker is described by it, in the post's own language;
 * - the `<hr>` goes: `app.css` draws the rule, so it can be a hairline.
 *
 * Runs last, so `rehype-autolink-headings` never puts a `#` on that heading.
 */

const LABEL_ID = 'footnotes-label';

const COPY = {
	en: {
		heading: 'Footnotes',
		back: (n, k) => (k > 1 ? `Back to reference ${n} (${k})` : `Back to reference ${n}`)
	},
	ko: {
		heading: '각주',
		back: (n, k) =>
			k > 1 ? `${n}번 각주 본문으로 돌아가기 (${k})` : `${n}번 각주 본문으로 돌아가기`
	}
};

/** `↩` with the text presentation selector, or iOS draws the emoji. */
const BACK = '↩︎';

/** @param {any} node @param {string} name */
const hasClass = (node, name) => {
	const cls = node.properties?.className;
	return Array.isArray(cls) ? cls.includes(name) : cls === name;
};

/** @param {any} node @param {(node: any, parent: any) => void} fn @param {any} [parent] */
function walk(node, fn, parent) {
	fn(node, parent);
	for (const child of node.children ?? []) walk(child, fn, node);
}

const text = (value) => ({ type: 'text', value });

/** @param {any} file */
function langOf(file) {
	const where = String(file?.filename ?? file?.path ?? '');
	return /[/\\]ko[/\\]/.test(where) ? 'ko' : 'en';
}

export function rehypeFootnotes() {
	/** @param {any} tree @param {any} file */
	return (tree, file) => {
		/** @type {any} */
		let section = null;
		/** @type {any} */
		let sectionParent = null;
		walk(tree, (node, parent) => {
			if (
				!section &&
				node.type === 'element' &&
				node.tagName === 'div' &&
				hasClass(node, 'footnotes')
			) {
				section = node;
				sectionParent = parent;
			}
		});
		if (!section) return;

		const copy = COPY[langOf(file)];
		const list = section.children.find((c) => c.type === 'element' && c.tagName === 'ol');
		if (!list) return;
		const items = list.children.filter((c) => c.type === 'element' && c.tagName === 'li');

		/** Old id (`fn-note`) → number, in list order — which is reading order. */
		/** @type {Map<string, number>} */
		const numberOf = new Map();
		items.forEach((li, i) => numberOf.set(String(li.properties.id), i + 1));

		/** Number → how many times the text cites it. */
		/** @type {Map<number, number>} */
		const citations = new Map();

		walk(tree, (node) => {
			if (node.type !== 'element' || node.tagName !== 'sup') return;
			const a = node.children?.find((c) => c.type === 'element' && hasClass(c, 'footnote-ref'));
			if (!a) return;
			const n = numberOf.get(String(a.properties.href).replace(/^#/, ''));
			if (!n) return;
			const k = (citations.get(n) ?? 0) + 1;
			citations.set(n, k);
			node.properties = { id: k === 1 ? `fnref-${n}` : `fnref-${n}-${k}` };
			a.properties = {
				href: `#fn-${n}`,
				className: ['footnote-ref'],
				ariaDescribedBy: LABEL_ID,
				dataFootnoteRef: ''
			};
			a.children = [text(String(n))];
		});

		items.forEach((li, i) => {
			const n = i + 1;
			li.properties = { id: `fn-${n}` };
			const times = citations.get(n) ?? 1;
			// Collected first: replacing them mid-walk would walk into the new ones.
			const found = [];
			walk(li, (node, parent) => {
				if (node.type === 'element' && hasClass(node, 'footnote-backref'))
					found.push({ node, parent });
			});
			for (const { node, parent } of found) {
				const links = [];
				for (let k = 1; k <= times; k++) {
					links.push(text(' '), {
						type: 'element',
						tagName: 'a',
						properties: {
							href: k === 1 ? `#fnref-${n}` : `#fnref-${n}-${k}`,
							className: ['footnote-backref'],
							ariaLabel: copy.back(n, k)
						},
						children:
							k === 1
								? [text(BACK)]
								: [
										text(BACK),
										{ type: 'element', tagName: 'sup', properties: {}, children: [text(String(k))] }
									]
					});
				}
				parent.children.splice(parent.children.indexOf(node), 1, ...links);
			}
		});

		const replacement = {
			type: 'element',
			tagName: 'section',
			properties: { className: ['footnotes'], ariaLabelledBy: LABEL_ID, dataFootnotes: '' },
			children: [
				{
					type: 'element',
					tagName: 'h2',
					properties: { id: LABEL_ID, className: ['footnotes-label'] },
					children: [text(copy.heading)]
				},
				list
			]
		};
		sectionParent.children.splice(sectionParent.children.indexOf(section), 1, replacement);
	};
}
