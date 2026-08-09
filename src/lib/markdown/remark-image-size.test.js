import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { remarkImageSize } from './remark-image-size.js';
import { remarkGallery } from './remark-gallery.js';

const ROOT = 'static';

function run(markdown, plugins = [[remarkImageSize, { root: ROOT }]]) {
	let processor = unified().use(remarkParse);
	for (const plugin of plugins) processor = processor.use(...[].concat(plugin));
	return processor.runSync(processor.parse(markdown));
}

/** Every image node in the tree, in order. */
function images(node, out = []) {
	if (node?.type === 'image') out.push(node);
	for (const child of node?.children ?? []) images(child, out);
	return out;
}

describe('remarkImageSize', () => {
	it('stamps the file size, and the attributes the placeholder needs', () => {
		const tree = run('![A shot](/images/uploads/SCR-20240820-sod.png)\n');
		const props = images(tree)[0].data.hProperties;
		expect(props.width).toBeGreaterThan(0);
		expect(props.height).toBeGreaterThan(0);
		expect(props['data-img-pending']).toBe('true');
		expect(props.loading).toBe('lazy');
		expect(props.decoding).toBe('async');
	});

	// The whole point: the box has to be the one the photo ends up in, and that
	// is the rotated one for a photo out of a phone.
	it('reports the displayed size of an Exif-rotated photo', () => {
		const tree = run('![Portrait](/images/uploads/us-camp/IMG_8855.jpeg)\n');
		const { width, height } = images(tree)[0].data.hProperties;
		expect({ width, height }).toEqual({ width: 1512, height: 2016 });
	});

	it('leaves a remote image alone — it cannot measure a file it does not have', () => {
		const tree = run('![Remote](https://example.com/a.png)\n');
		expect(images(tree)[0].data?.hProperties).toBeUndefined();
	});

	it('leaves an image that is not there alone rather than guessing a box', () => {
		const tree = run('![Missing](/images/uploads/nope-not-here.png)\n');
		expect(images(tree)[0].data?.hProperties).toBeUndefined();
	});

	// `..` in a URL would otherwise read files from outside the served directory.
	it('refuses to climb out of the static directory', () => {
		const tree = run('![Escape](/../package.json)\n');
		expect(images(tree)[0].data?.hProperties).toBeUndefined();
	});

	it('measures an image inside a link, or a list, or a caption', () => {
		const tree = run('- [![Nested](/images/uploads/SCR-20240820-sod.png)](/somewhere)\n');
		expect(images(tree)[0].data.hProperties.width).toBeGreaterThan(0);
	});

	it('hands the size to the gallery, which puts it on the slide', () => {
		const tree = run(
			'![One](/images/uploads/SCR-20240820-sod.png)\n![Two](/images/uploads/SCR-20240820-dos.png)\n',
			[[remarkImageSize, { root: ROOT }], remarkGallery]
		);
		const tag = tree.children.find(
			(n) => n.type === 'html' && n.value.startsWith('<Gallery')
		)?.value;
		const payload = JSON.parse(tag.slice(tag.indexOf('{') + 1, tag.lastIndexOf('}')));
		expect(payload).toHaveLength(2);
		for (const slide of payload) {
			expect(slide.width).toBeGreaterThan(0);
			expect(slide.height).toBeGreaterThan(0);
		}
	});
});
