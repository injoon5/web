import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CONTENT_SIGNAL } from './content-signals.js';
import {
	estimateTokens,
	isMarkdownNegotiable,
	markdownResponse,
	normalizePathname,
	parseAccept,
	prefersMarkdown
} from './markdown-negotiation.js';

const robotsTxt = readFileSync(
	fileURLToPath(new URL('../../../static/robots.txt', import.meta.url)),
	'utf8'
);

describe('Content-Signal', () => {
	it('declares ai-train, search, and ai-input in robots.txt', () => {
		expect(robotsTxt).toMatch(/^\s*User-agent:\s*\*/m);
		expect(robotsTxt).toContain(`Content-Signal: ${CONTENT_SIGNAL}`);
		expect(CONTENT_SIGNAL).toMatch(/ai-train=(yes|no)/);
		expect(CONTENT_SIGNAL).toMatch(/search=(yes|no)/);
		expect(CONTENT_SIGNAL).toMatch(/ai-input=(yes|no)/);
	});
});

describe('parseAccept', () => {
	it('defaults q to 1', () => {
		expect(parseAccept('text/markdown')).toEqual([{ type: 'text/markdown', q: 1 }]);
	});

	it('reads q values', () => {
		expect(parseAccept('text/html, text/markdown;q=0.8')).toEqual([
			{ type: 'text/html', q: 1 },
			{ type: 'text/markdown', q: 0.8 }
		]);
	});
});

describe('prefersMarkdown', () => {
	it('is false for a typical browser Accept', () => {
		expect(
			prefersMarkdown(
				'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
			)
		).toBe(false);
	});

	it('is false when Accept is missing or */* only', () => {
		expect(prefersMarkdown(null)).toBe(false);
		expect(prefersMarkdown('')).toBe(false);
		expect(prefersMarkdown('*/*')).toBe(false);
	});

	it('is true for Accept: text/markdown', () => {
		expect(prefersMarkdown('text/markdown')).toBe(true);
		expect(prefersMarkdown('text/x-markdown')).toBe(true);
	});

	it('prefers markdown when listed ahead of html at equal quality', () => {
		expect(prefersMarkdown('text/markdown, text/html;q=0.9')).toBe(true);
	});

	it('prefers html when markdown is a fallback', () => {
		expect(prefersMarkdown('text/html, text/markdown;q=0.1')).toBe(false);
	});

	it('rejects q=0 markdown', () => {
		expect(prefersMarkdown('text/markdown;q=0')).toBe(false);
	});
});

describe('isMarkdownNegotiable', () => {
	it('allows public documents', () => {
		expect(isMarkdownNegotiable('/')).toBe(true);
		expect(isMarkdownNegotiable('/blog')).toBe(true);
		expect(isMarkdownNegotiable('/blog/now-listening/')).toBe(true);
		expect(isMarkdownNegotiable('/now')).toBe(true);
	});

	it('skips APIs, assets, admin, and file-like paths', () => {
		expect(isMarkdownNegotiable('/api/markdown')).toBe(false);
		expect(isMarkdownNegotiable('/api/comments')).toBe(false);
		expect(isMarkdownNegotiable('/_app/immutable/x.js')).toBe(false);
		expect(isMarkdownNegotiable('/admin')).toBe(false);
		expect(isMarkdownNegotiable('/robots.txt')).toBe(false);
		expect(isMarkdownNegotiable('/rss.xml')).toBe(false);
		expect(isMarkdownNegotiable('/images/x.jpg')).toBe(false);
	});
});

describe('normalizePathname', () => {
	it('strips a trailing slash except on root', () => {
		expect(normalizePathname('/')).toBe('/');
		expect(normalizePathname('/blog/')).toBe('/blog');
		expect(normalizePathname('/blog/foo/?x=1')).toBe('/blog/foo');
	});
});

describe('markdownResponse', () => {
	it('sets markdown type, Vary, token count, and Content-Signal', () => {
		const body = '# Hello\n';
		const res = markdownResponse(body);
		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
		expect(res.headers.get('Vary')).toBe('Accept');
		expect(res.headers.get('x-markdown-tokens')).toBe(String(estimateTokens(body)));
		expect(res.headers.get('Content-Signal')).toBe(CONTENT_SIGNAL);
	});

	it('forwards a non-200 status', () => {
		expect(markdownResponse('# Not found\n', { status: 404 }).status).toBe(404);
	});
});

describe('estimateTokens', () => {
	it('is ceil(length / 4)', () => {
		expect(estimateTokens('abcd')).toBe(1);
		expect(estimateTokens('abcde')).toBe(2);
		expect(estimateTokens('')).toBe(0);
	});
});
