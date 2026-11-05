import { error, redirect } from '@sveltejs/kit';
import { browser } from '$app/env';
import { articleIndex } from '#lib/content/article-index.js';
import { articleBase, articlePath, resolveLang } from '#lib/content/article-paths.js';
import { blogModules, projectModules } from '#lib/content/article-modules.js';
import { cookieLang, loadVisitor } from '#lib/visitor.svelte.js';

/**
 * The universal load both article routes share. No server load, ever: the pages
 * are prerendered, and a server load would put a function round trip in front
 * of every client-side navigation (see CLAUDE.md).
 *
 * It imports only the language being shown. The other one is preloaded after
 * the page mounts, so switching is still instant.
 *
 * @param {import('#lib/content/article-paths.js').ArticleKind} kind
 */
export function articleLoad(kind) {
	const modules = kind === 'blog' ? blogModules : projectModules;

	/** @param {{ params: { slug: string, lang?: string }, url: URL, fetch: typeof fetch }} event */
	return async ({ params, url, fetch }) => {
		const { slug } = params;
		const entry = (await articleIndex(fetch))[kind][slug];
		if (!entry) error(404, `Could not find ${slug}`);
		const { langs } = entry;

		if (browser) {
			loadVisitor(fetch);

			// A visitor who picked English, following a link inside the site to the
			// bare URL. A direct visit was already redirected by vercel.json; this
			// is the same rule for client-side navigation, where no request is made.
			// `?lang=` is the old form of these URLs.
			const wanted = url.searchParams.get('lang') ?? cookieLang();
			if (!params.lang && wanted === 'en' && langs[0] !== 'en' && langs.includes('en')) {
				redirect(307, articlePath(kind, slug, 'en', langs));
			}
		}

		const lang = resolveLang(params.lang, langs);
		const mod = await modules[lang][`/src/content/${kind}/${lang}/${slug}.md`]();

		return {
			kind,
			slug,
			lang,
			langs,
			meta: mod.metadata,
			content: mod.default,
			series: entry.series?.[lang] ?? [],
			// Likes and comments belong to the article, not to one language of it.
			articlePath: articleBase(kind, slug),
			canonicalPath: articlePath(kind, slug, lang, langs)
		};
	};
}
