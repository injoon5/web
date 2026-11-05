import { blogModules, projectModules } from './article-modules.js';
import { seriesMap } from './series.js';

const noop = () => {};

/**
 * Fetch everything an article's load waits on — both languages' content chunks
 * and, for a post, the series lists — so that a click finds it all in memory.
 * The loads' own `import()`s then resolve from the module map.
 *
 * Likes, votes and the visitor's `ipHash` are not part of this: they arrive
 * after the post renders.
 *
 * @param {string} pathname  `/blog/<slug>` or `/projects/<slug>`
 */
export function preloadArticle(pathname) {
	const match = pathname.match(/^\/(blog|projects)\/([^/]+)\/?$/);
	if (!match) return;
	const [, kind, slug] = match;
	const modules = kind === 'blog' ? blogModules : projectModules;
	for (const lang of /** @type {const} */ (['en', 'ko'])) {
		modules[lang][`/src/content/${kind}/${lang}/${slug}.md`]?.().catch(noop);
	}
	if (kind === 'blog') seriesMap(fetch);
}

/**
 * Preload every article linked inside `node` as the link nears the viewport.
 * Paired with `data-sveltekit-preload-code="viewport"`, which covers the
 * route's own JS: together a click costs no request before the post renders.
 *
 * Starts at idle so the listing's own requests go first, and stays off on
 * Save-Data and 2G, like `FontPrefetch`.
 *
 * @param {HTMLElement} node
 */
export function preloadArticles(node) {
	const connection = /** @type {any} */ (navigator).connection;
	if (connection?.saveData || /2g/.test(connection?.effectiveType ?? '')) return;

	const io = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				io.unobserve(entry.target);
				// Read now, not when observed: a link can lose its `href` in between
				// (SeriesList's row for the post being read), and `href` is then ''.
				const href = /** @type {HTMLAnchorElement} */ (entry.target).href;
				if (href) preloadArticle(new URL(href).pathname);
			}
		},
		{ rootMargin: '200px' }
	);

	const start = () => {
		for (const a of node.querySelectorAll('a[href]')) io.observe(a);
	};
	const idle = window.requestIdleCallback ?? ((cb) => setTimeout(cb, 200));
	const cancelIdle = window.cancelIdleCallback ?? clearTimeout;
	const handle = idle(start);

	return {
		destroy() {
			cancelIdle(handle);
			io.disconnect();
		}
	};
}
