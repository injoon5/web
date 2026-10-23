import { describe, it, expect } from 'vitest';
import { compile } from 'mdsvex';
import remarkFootnotes from 'remark-footnotes';
import { rehypeFootnotes } from './rehype-footnotes.js';

/**
 * Through mdsvex itself: its bundled parser is the one `remark-footnotes` 2
 * has to plug into, and its own mdast-to-hast writes the markup this rewrites.
 */
async function render(markdown, filename = '/src/content/blog/en/post.md') {
	const out = await compile(markdown, {
		filename,
		// Without it mdsvex skips a `.md` file and answers undefined.
		extensions: ['.md'],
		remarkPlugins: [remarkFootnotes],
		rehypePlugins: [rehypeFootnotes]
	});
	if (!out) throw new Error('mdsvex compiled nothing');
	return out.code;
}

const SAMPLE = 'One[^b] two[^a] one again[^b].\n\n[^a]: Note A.\n[^b]: Note B.\n';

describe('rehypeFootnotes', () => {
	it('numbers markers in reading order, whatever the labels', async () => {
		const html = await render(SAMPLE);
		const markers = [...html.matchAll(/data-footnote-ref\s*>(\d+)</g)].map((m) => m[1]);
		expect(markers).toEqual(['1', '2', '1']);
		expect(html).toMatch(/<li id="fn-1">\s*(?:<p>)?Note B\./);
		expect(html).toMatch(/<li id="fn-2">\s*(?:<p>)?Note A\./);
	});

	it('gives a repeated citation its own id, and the note a way back to each', async () => {
		const html = await render(SAMPLE);
		const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids).toEqual(expect.arrayContaining(['fnref-1', 'fnref-1-2', 'fnref-2']));
		expect(html).toContain('href="#fnref-1-2"');
	});

	it('is a labelled section with no <hr>, and a back link iOS will not turn into an emoji', async () => {
		const html = await render(SAMPLE);
		expect(html).toContain(
			'<section class="footnotes" aria-labelledby="footnotes-label" data-footnotes>'
		);
		expect(html).toContain('<h2 id="footnotes-label" class="footnotes-label">Footnotes</h2>');
		expect(html).not.toContain('<hr');
		expect(html).toContain('↩︎');
		expect(html).toContain('aria-describedby="footnotes-label"');
	});

	it('speaks Korean in a Korean post', async () => {
		const html = await render(SAMPLE, '/src/content/blog/ko/post.md');
		expect(html).toContain('>각주</h2>');
		expect(html).toContain('aria-label="1번 각주 본문으로 돌아가기"');
	});

	it('leaves a post without footnotes alone', async () => {
		const html = await render('Just text.\n');
		expect(html).not.toContain('footnotes');
	});
});
