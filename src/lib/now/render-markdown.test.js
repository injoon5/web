import { describe, it, expect } from 'vitest';
import { renderNow, safeUrl } from './render-markdown.js';

describe('renderNow', () => {
	it('renders ordinary markdown', () => {
		const html = renderNow(
			'# Now\n\nReading **papers** and [a site](https://example.com).\n\n- one\n- two'
		);
		expect(html).toContain('<h1>Now</h1>');
		expect(html).toContain('<strong>papers</strong>');
		expect(html).toContain('<a href="https://example.com">a site</a>');
		expect(html).toContain('<li>one</li>');
	});

	it('shows raw HTML as text instead of rendering it', () => {
		const html = renderNow('hi <script>alert(1)</script> <img src=x onerror=alert(1)>');
		expect(html).not.toContain('<script');
		expect(html).not.toMatch(/<img[^>]*onerror/);
		expect(html).toContain('&lt;script&gt;');
	});

	it('drops URLs that could run script, keeping the link text', () => {
		const html = renderNow('[click](javascript:alert(1)) ![x](data:text/html,hi)');
		expect(html).not.toContain('javascript:');
		expect(html).not.toContain('data:');
		expect(html).toContain('click');
	});

	it('keeps links on this site and protocol-relative ones out', () => {
		expect(safeUrl('/blog/us-camp')).toBe('/blog/us-camp');
		expect(safeUrl('#top')).toBe('#top');
		expect(safeUrl('mailto:me@injoon5.com')).toBe('mailto:me@injoon5.com');
		expect(safeUrl('//evil.example')).toBeNull();
		expect(safeUrl(' JavaScript:alert(1)')).toBeNull();
	});

	it('is empty for no content', () => {
		expect(renderNow('')).toBe('');
		expect(renderNow(null)).toBe('');
	});
});
