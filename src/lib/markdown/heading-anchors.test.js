import { describe, it, expect } from 'vitest';
import { compile } from 'mdsvex';
import config from '../../../mdsvex.config.js';

/** Through the site's own pipeline, which is where the heading links are set up. */
async function render(markdown) {
	const out = await compile(markdown, { ...config, filename: '/src/content/blog/en/post.md' });
	if (!out) throw new Error('mdsvex compiled nothing');
	return out.code;
}

describe('heading links', () => {
	it('make the heading text the link, with no anchor glyph in the text', async () => {
		const html = await render('## A section\n\nBody.\n');
		expect(html).toContain(
			'<h2 id="a-section"><a class="heading-anchor" href="#a-section">A section</a></h2>'
		);
		expect(html).not.toMatch(/>#</);
	});

	it('leave the footnotes heading alone', async () => {
		const html = await render('Text.[^a]\n\n[^a]: Note.\n');
		expect(html).toContain('<h2 id="footnotes-label" class="footnotes-label">Footnotes</h2>');
	});
});
