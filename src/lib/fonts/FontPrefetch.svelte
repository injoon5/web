<!-- Listing pages warm the cache with the fonts a post is about to need: the
     Hangul files the site's own text is cut into (posts are Korean by default)
     and the small extended file. Each is a `rel=prefetch`, so the browser fetches
     it at idle priority, behind everything this page still wants, and a post
     opened afterwards finds it in the HTTP cache — /fonts is served immutable.

     Not on Save-Data or a 2G connection, where a speculative 240KB is the wrong
     trade, and no Hangul for a visitor who chose English. -->
<script module>
	/** Shared by every instance: one prefetch per file per document, however many
	 *  listings the visitor moves between. Not state — nothing renders from it. */
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const warmed = new Set();
</script>

<script>
	import { onMount } from 'svelte';
	import { files, hangul } from '#lib/fonts/interlude.json';
	import { cookieLang } from '#lib/cookies.js';

	onMount(() => {
		const connection = /** @type {any} */ (navigator).connection;
		if (connection?.saveData || /2g/.test(connection?.effectiveType ?? '')) return;

		const english = cookieLang() === 'en';
		const urls = [files.extended.url, ...(english ? [] : hangul.site.map((f) => f.url))];

		let cancelled = false;
		let idleHandle = 0;
		const warm = () => {
			if (cancelled) return;
			for (const href of urls) {
				if (warmed.has(href)) continue;
				warmed.add(href);
				const link = document.createElement('link');
				link.rel = 'prefetch';
				link.as = 'font';
				link.type = 'font/woff2';
				// Fonts are fetched in CORS mode; a prefetch without it is a
				// different cache entry and would be downloaded twice.
				link.crossOrigin = 'anonymous';
				link.href = href;
				document.head.append(link);
			}
		};
		const whenIdle = () => {
			idleHandle =
				'requestIdleCallback' in window
					? requestIdleCallback(warm, { timeout: 4000 })
					: window.setTimeout(warm, 1500);
		};
		// After `load`, so the page's own images and fonts are never queued
		// behind fonts for a page the visitor may not open.
		if (document.readyState === 'complete') whenIdle();
		else window.addEventListener('load', whenIdle, { once: true });

		return () => {
			cancelled = true;
			window.removeEventListener('load', whenIdle);
			if ('cancelIdleCallback' in window) cancelIdleCallback(idleHandle);
			else clearTimeout(idleHandle);
		};
	});
</script>
