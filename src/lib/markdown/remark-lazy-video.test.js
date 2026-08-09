import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { remarkLazyVideo } from './remark-lazy-video.js';
import { remarkGallery } from './remark-gallery.js';

function run(markdown, plugins = [remarkLazyVideo]) {
	let processor = unified().use(remarkParse);
	for (const plugin of plugins) processor = processor.use(plugin);
	return processor.runSync(processor.parse(markdown));
}

const html = (tree) => tree.children.filter((n) => n.type === 'html').map((n) => n.value);
const players = (tree) => html(tree).filter((v) => v.startsWith('<LazyVideo'));
const scripts = (tree) => html(tree).filter((v) => v.trimStart().startsWith('<script'));

describe('remarkLazyVideo', () => {
	it('turns an image pointing at a video into a player, with its own import', () => {
		const tree = run('![Play the demo](/videos/projects/watch.mp4)\n');
		expect(players(tree)).toEqual([
			'<LazyVideo src={"/videos/projects/watch.mp4"} label={"Play the demo"} />'
		]);
		expect(scripts(tree)[0]).toContain("import LazyVideo from '$lib/ui/LazyVideo.svelte';");
	});

	it('turns a lone link to a video into a player too', () => {
		const tree = run('[Watch it](/videos/projects/watch.webm)\n');
		expect(players(tree)).toEqual([
			'<LazyVideo src={"/videos/projects/watch.webm"} label={"Watch it"} />'
		]);
	});

	it('prefers the title over the alt text, the way a caption works elsewhere', () => {
		const tree = run('![Alt](/videos/a.mp4 "The title")\n');
		expect(players(tree)[0]).toContain('label={"The title"}');
	});

	it('leaves the label off entirely when there is none, so the default applies', () => {
		const tree = run('![](/videos/a.mov)\n');
		expect(players(tree)).toEqual(['<LazyVideo src={"/videos/a.mov"} />']);
	});

	it('adds nothing to a post with no videos in it', () => {
		const tree = run('![A photo](/images/a.png)\n\nSome prose.\n');
		expect(players(tree)).toEqual([]);
		expect(scripts(tree)).toEqual([]);
	});

	it('keeps an import the author wrote themselves', () => {
		const tree = run(
			"<script>\n\timport LazyVideo from '$lib/ui/LazyVideo.svelte';\n</script>\n\n![Demo](/videos/a.mp4)\n"
		);
		expect(scripts(tree)[0].match(/import LazyVideo/g)).toHaveLength(1);
	});

	it('splices its import into an existing instance script', () => {
		const tree = run('<script>\n\tlet x = 1;\n</script>\n\n![Demo](/videos/a.mp4)\n');
		expect(scripts(tree)[0]).toContain('import LazyVideo');
		expect(scripts(tree)[0]).toContain('let x = 1;');
	});

	// A video is written on its own line. Anything else would have to decide what
	// a player does in the middle of a sentence, and the answer is nothing.
	it('leaves a video alone when the paragraph is not only that video', () => {
		const tree = run('Here is [the demo](/videos/a.mp4) if you want it.\n');
		expect(players(tree)).toEqual([]);
	});

	it('leaves a paragraph holding two videos alone', () => {
		const tree = run('![One](/videos/a.mp4)\n![Two](/videos/b.mp4)\n');
		expect(players(tree)).toEqual([]);
	});

	it('is not fooled by a file that merely mentions a video extension', () => {
		const tree = run('![Not a video](/images/mp4-explained.png)\n');
		expect(players(tree)).toEqual([]);
	});

	// It runs first for exactly this reason: `remarkGallery` collects image nodes
	// into a strip, and a video written as an image is an image node.
	it('takes the video before the gallery can collect it', () => {
		const tree = run('![Clip](/videos/a.mp4)\n\n![One](/a.png)\n![Two](/b.png)\n', [
			remarkLazyVideo,
			remarkGallery
		]);
		expect(players(tree)).toHaveLength(1);
		expect(html(tree).filter((v) => v.startsWith('<Gallery'))).toHaveLength(1);
	});
});
