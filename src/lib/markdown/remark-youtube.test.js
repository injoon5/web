import { describe, it, expect } from 'vitest';
import { mdsvexTree } from './mdsvex-tree.js';
import { remarkYouTube, youTubeVideo } from './remark-youtube.js';

const run = (markdown) => mdsvexTree(markdown, [remarkYouTube]);

const frames = (tree) =>
	tree.children
		.filter((n) => n.type === 'html' && n.value.startsWith('<iframe'))
		.map((n) => n.value);

describe('youTubeVideo', () => {
	it.each([
		['https://www.youtube.com/watch?v=FpIRgBNSDcs', { id: 'FpIRgBNSDcs', start: 0 }],
		['https://youtu.be/FpIRgBNSDcs?t=1m30s', { id: 'FpIRgBNSDcs', start: 90 }],
		['https://m.youtube.com/watch?v=FpIRgBNSDcs&t=42', { id: 'FpIRgBNSDcs', start: 42 }],
		['https://www.youtube.com/shorts/FpIRgBNSDcs', { id: 'FpIRgBNSDcs', start: 0 }],
		['https://www.youtube.com/embed/FpIRgBNSDcs?start=7', { id: 'FpIRgBNSDcs', start: 7 }]
	])('reads %s', (url, expected) => {
		expect(youTubeVideo(url)).toEqual(expected);
	});

	it.each([
		'https://www.youtube.com/@channel',
		'https://www.youtube.com/watch?v=short',
		'https://notyoutube.com/watch?v=FpIRgBNSDcs',
		'javascript:alert(1)',
		'endpoints'
	])('ignores %s', (url) => {
		expect(youTubeVideo(url)).toBeNull();
	});
});

describe('remarkYouTube', () => {
	it('embeds a bare URL on its own line, lazily and without cookies', async () => {
		const [frame] = frames(await run('https://www.youtube.com/watch?v=FpIRgBNSDcs\n'));
		expect(frame).toContain('src="https://www.youtube-nocookie.com/embed/FpIRgBNSDcs"');
		expect(frame).toContain('loading="lazy"');
		expect(frame).toContain('title="YouTube video player"');
	});

	it('names the frame after the link text', async () => {
		const [frame] = frames(await run('[Camp day one](https://youtu.be/FpIRgBNSDcs?t=90)\n'));
		expect(frame).toContain('title="Camp day one"');
		expect(frame).toContain('embed/FpIRgBNSDcs?start=90"');
	});

	it('escapes the title for HTML and for Svelte markup', async () => {
		const [frame] = frames(await run('[A "{quoted}" <title>](https://youtu.be/FpIRgBNSDcs)\n'));
		// Smartypants has curled the quotes by the time the plugin sees them.
		expect(frame).toContain('title="A \u201c&#123;quoted&#125;\u201d &lt;title&gt;"');
	});

	it('leaves a link inside a sentence, and any other lone link, alone', async () => {
		expect(frames(await run('[This](https://youtu.be/FpIRgBNSDcs) is great.\n'))).toEqual([]);
		expect(frames(await run('[Site](https://example.com/watch?v=FpIRgBNSDcs)\n'))).toEqual([]);
		expect(frames(await run('endpoints\n'))).toEqual([]);
	});
});
