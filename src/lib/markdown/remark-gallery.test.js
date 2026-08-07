import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { remarkGallery } from './remark-gallery.js';

/** Run the plugin over markdown and hand back the transformed root. */
function run(markdown, options) {
	const processor = unified().use(remarkParse).use(remarkGallery, options);
	const tree = processor.parse(markdown);
	return processor.runSync(tree);
}

const html = (tree) => tree.children.filter((n) => n.type === 'html').map((n) => n.value);
const galleries = (tree) => html(tree).filter((v) => v.startsWith('<Gallery'));

/** The `images={...}` payload, back as data. */
function payload(tag) {
	return JSON.parse(tag.slice(tag.indexOf('{') + 1, tag.lastIndexOf('}')));
}

describe('remarkGallery', () => {
	it('turns a run of images on consecutive lines into one gallery', () => {
		const tree = run('![One](/a.png)\n![Two](/b.png)\n![Three](/c.png)\n');
		const found = galleries(tree);
		expect(found).toHaveLength(1);
		expect(payload(found[0])).toEqual([
			{ src: '/a.png', alt: 'One' },
			{ src: '/b.png', alt: 'Two' },
			{ src: '/c.png', alt: 'Three' }
		]);
	});

	it('carries the markdown title through as a caption', () => {
		const tree = run('![One](/a.png "Golden hour")\n![Two](/b.png)\n');
		expect(payload(galleries(tree)[0])[0]).toEqual({
			src: '/a.png',
			alt: 'One',
			title: 'Golden hour'
		});
	});

	it('leaves a lone image alone', () => {
		const tree = run('![Only](/a.png)\n');
		expect(galleries(tree)).toHaveLength(0);
		expect(tree.children[0].type).toBe('paragraph');
	});

	it('leaves images separated by a blank line stacked — that is the escape hatch', () => {
		const tree = run('![One](/a.png)\n\n![Two](/b.png)\n');
		expect(galleries(tree)).toHaveLength(0);
		expect(tree.children.every((n) => n.type === 'paragraph')).toBe(true);
	});

	it('leaves a paragraph that mixes images with prose alone', () => {
		const tree = run('![One](/a.png)\nsome words\n![Two](/b.png)\n');
		expect(galleries(tree)).toHaveLength(0);
	});

	it('leaves linked images alone — the link is the point of them', () => {
		const tree = run('[![One](/a.png)](/one)\n[![Two](/b.png)](/two)\n');
		expect(galleries(tree)).toHaveLength(0);
	});

	it('ignores image runs nested in a blockquote or list', () => {
		const tree = run(
			'> ![One](/a.png)\n> ![Two](/b.png)\n\n- ![Three](/c.png)\n  ![Four](/d.png)\n'
		);
		expect(galleries(tree)).toHaveLength(0);
	});

	it('honours a raised minImages', () => {
		const two = '![One](/a.png)\n![Two](/b.png)\n';
		expect(galleries(run(two, { minImages: 3 }))).toHaveLength(0);
		expect(galleries(run(two + '![Three](/c.png)\n', { minImages: 3 }))).toHaveLength(1);
	});

	it('converts every run in the document, not just the first', () => {
		const tree = run('![a](/a.png)\n![b](/b.png)\n\ntext\n\n![c](/c.png)\n![d](/d.png)\n');
		expect(galleries(tree)).toHaveLength(2);
	});
});

describe('remarkGallery explicit fence', () => {
	const text = (tree) =>
		tree.children
			.filter((n) => n.type === 'paragraph')
			.map((n) => n.children.map((c) => c.value ?? `![](${c.url})`).join(''));

	it('gathers images a blank line apart, which the implicit form leaves alone', () => {
		const md = ':::gallery\n![One](/a.png)\n\n![Two](/b.png)\n:::\n';
		expect(galleries(run(md.replace(/:::gallery\n|\n:::/g, '')))).toHaveLength(0);

		const found = galleries(run(md));
		expect(found).toHaveLength(1);
		expect(payload(found[0])).toEqual([
			{ src: '/a.png', alt: 'One' },
			{ src: '/b.png', alt: 'Two' }
		]);
	});

	it('makes a gallery of one, which two loose images would never become', () => {
		expect(payload(galleries(run(':::gallery\n![Only](/a.png)\n:::\n'))[0])).toEqual([
			{ src: '/a.png', alt: 'Only' }
		]);
	});

	it('carries titles through as captions', () => {
		const tree = run(':::gallery\n![One](/a.png "Golden hour")\n:::\n');
		expect(payload(galleries(tree)[0])[0].title).toBe('Golden hour');
	});

	it('leaves the prose around it exactly where it was', () => {
		const tree = run('before\n\n:::gallery\n![One](/a.png)\n![Two](/b.png)\n:::\n\nafter\n');
		expect(galleries(tree)).toHaveLength(1);
		expect(text(tree)).toEqual(['before', 'after']);
	});

	it('keeps non-image content from inside the fence rather than dropping it', () => {
		const tree = run(':::gallery\n![One](/a.png)\n\nnot an image\n\n![Two](/b.png)\n:::\n');
		expect(payload(galleries(tree)[0])).toHaveLength(2);
		expect(text(tree)).toEqual(['not an image']);
	});

	it('transforms nothing when the fence is never closed — the mistake stays visible', () => {
		const tree = run(':::gallery\n![One](/a.png)\n![Two](/b.png)\n');
		expect(galleries(tree)).toHaveLength(0);
		expect(tree.children[0].children[0].value).toContain(':::gallery');
	});

	it('transforms nothing when the fence holds no images', () => {
		const tree = run(':::gallery\n:::\n');
		expect(galleries(tree)).toHaveLength(0);
		expect(tree.children[0].type).toBe('paragraph');
	});

	it('leaves a stray ::: in prose alone', () => {
		const tree = run('a ::: b\n');
		expect(galleries(tree)).toHaveLength(0);
		expect(text(tree)).toEqual(['a ::: b']);
	});

	it('still converts implicit runs elsewhere in the same document', () => {
		const tree = run(
			'![a](/a.png)\n![b](/b.png)\n\n:::gallery\n![c](/c.png)\n\n![d](/d.png)\n:::\n'
		);
		const found = galleries(tree);
		expect(found).toHaveLength(2);
		expect(payload(found[1]).map((i) => i.src)).toEqual(['/c.png', '/d.png']);
	});
});

describe('remarkGallery import injection', () => {
	const scripts = (tree) => html(tree).filter((v) => v.trimStart().startsWith('<script'));

	it('adds no import when there is no gallery', () => {
		expect(scripts(run('![Only](/a.png)\n'))).toHaveLength(0);
	});

	it('prepends an instance script when the file has none', () => {
		const tree = run('![One](/a.png)\n![Two](/b.png)\n');
		expect(tree.children[0].value).toContain("import Gallery from '$lib/lightbox/Gallery.svelte';");
		// mdsvex hoists it, but leading it keeps the emitted source readable.
		expect(tree.children[0].type).toBe('html');
	});

	it('splices into an existing instance script rather than adding a second one', () => {
		const source =
			"<script>\n\timport LazyVideo from '$lib/ui/LazyVideo.svelte';\n</script>\n\n![One](/a.png)\n![Two](/b.png)\n";
		const tree = run(source);
		const found = scripts(tree);
		expect(found).toHaveLength(1);
		expect(found[0]).toContain("import Gallery from '$lib/lightbox/Gallery.svelte';");
		expect(found[0]).toContain("import LazyVideo from '$lib/ui/LazyVideo.svelte';");
	});

	it('does not splice into a module script — that is not where imports for markup go', () => {
		const source =
			'<script module>\n\texport const x = 1;\n</script>\n\n![One](/a.png)\n![Two](/b.png)\n';
		const tree = run(source);
		const found = scripts(tree);
		expect(found).toHaveLength(2);
		const moduleScript = found.find((v) => v.includes('module'));
		expect(moduleScript).not.toContain('Gallery.svelte');
	});

	it('leaves an author who already imported Gallery with exactly their own import', () => {
		const source =
			"<script>\n\timport Gallery from '$lib/lightbox/Gallery.svelte';\n</script>\n\n![One](/a.png)\n![Two](/b.png)\n";
		const tree = run(source);
		const found = scripts(tree);
		expect(found).toHaveLength(1);
		expect(found[0].match(/Gallery\.svelte/g)).toHaveLength(1);
	});
});
