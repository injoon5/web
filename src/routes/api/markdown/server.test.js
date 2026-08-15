import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/server/markdown-pages.js', () => ({
	markdownForPath: vi.fn()
}));

import { markdownForPath } from '$lib/server/markdown-pages.js';
import { GET } from './+server.js';
import { CONTENT_SIGNAL } from '$lib/server/content-signals.js';

function request(path, lang) {
	const url = new URL('http://x/api/markdown');
	if (path) url.searchParams.set('path', path);
	if (lang) url.searchParams.set('lang', lang);
	return {
		url,
		cookies: { get: () => undefined }
	};
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('GET /api/markdown', () => {
	it('serves markdown for a resolved path', async () => {
		markdownForPath.mockReturnValue({ body: '# Home\n', status: 200 });
		const res = await GET(request('/'));
		expect(markdownForPath).toHaveBeenCalledWith('/', { lang: undefined });
		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
		expect(res.headers.get('Content-Signal')).toBe(CONTENT_SIGNAL);
		expect(await res.text()).toBe('# Home\n');
	});

	it('forwards lang from the query', async () => {
		markdownForPath.mockReturnValue({ body: '# EN\n', status: 200 });
		await GET(request('/blog/us-camp', 'en'));
		expect(markdownForPath).toHaveBeenCalledWith('/blog/us-camp', { lang: 'en' });
	});

	it('rejects traversal in path', async () => {
		const res = await GET(request('/../../etc/passwd'));
		expect(res.status).toBe(404);
		expect(markdownForPath).not.toHaveBeenCalled();
	});

	it('404s when the path has no markdown', async () => {
		markdownForPath.mockReturnValue(null);
		const res = await GET(request('/nope'));
		expect(res.status).toBe(404);
		expect(res.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
	});
});
