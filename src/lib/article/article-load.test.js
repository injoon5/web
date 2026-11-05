import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({ cookie: /** @type {string | null} */ (null) }));
const index = vi.hoisted(() => ({
	blog: {
		both: { langs: ['ko', 'en'], series: { ko: [{ slug: 'both', title: '둘' }], en: [] } },
		solo: { langs: ['ko'] }
	},
	projects: {}
}));
vi.mock('#lib/content/article-index.js', () => ({ articleIndex: async () => index }));

vi.mock('#lib/content/article-modules.js', () => {
	const mod = (lang) => async () => ({ default: `Content:${lang}`, metadata: { title: lang } });
	return {
		blogModules: {
			ko: { '/src/content/blog/ko/both.md': mod('ko'), '/src/content/blog/ko/solo.md': mod('ko') },
			en: { '/src/content/blog/en/both.md': mod('en') }
		},
		projectModules: { ko: {}, en: {} }
	};
});

vi.mock('#lib/visitor.svelte.js', () => ({
	cookieLang: () => state.cookie,
	loadVisitor: () => {}
}));

import { articleLoad } from './article-load.js';

const load = articleLoad('blog');
const run = (path, params) => load({ params, url: new URL(`http://x${path}`), fetch });

beforeEach(() => {
	state.cookie = null;
});

describe('articleLoad', () => {
	it('imports only the language in the URL', async () => {
		const data = await run('/blog/both/en', { slug: 'both', lang: 'en' });
		expect(data).toMatchObject({
			lang: 'en',
			langs: ['ko', 'en'],
			content: 'Content:en',
			articlePath: '/blog/both',
			canonicalPath: '/blog/both/en'
		});
	});

	it('renders Korean at /en of a Korean-only post, canonical to the bare URL', async () => {
		const data = await run('/blog/solo/en', { slug: 'solo', lang: 'en' });
		expect(data).toMatchObject({ lang: 'ko', canonicalPath: '/blog/solo' });
	});

	it('sends a visitor who picked English from the bare URL to /en', async () => {
		state.cookie = 'en';
		await expect(run('/blog/both', { slug: 'both' })).rejects.toMatchObject({
			status: 307,
			location: '/blog/both/en'
		});
	});

	it('honours the old ?lang= form the same way', async () => {
		await expect(run('/blog/both?lang=en', { slug: 'both' })).rejects.toMatchObject({
			location: '/blog/both/en'
		});
		state.cookie = 'en';
		const data = await run('/blog/both?lang=ko', { slug: 'both' });
		expect(data.lang).toBe('ko');
	});

	it('does not redirect when the post has no English', async () => {
		state.cookie = 'en';
		expect((await run('/blog/solo', { slug: 'solo' })).lang).toBe('ko');
	});

	it('is a 404 for an unpublished or unknown slug', async () => {
		await expect(run('/blog/nope', { slug: 'nope' })).rejects.toMatchObject({ status: 404 });
	});
});
