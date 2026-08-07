<script>
	import { createDialKit } from 'dialkit/svelte';
	import { ARTICLE_DEFAULTS, articleSettings } from '$lib/article/settings.svelte.js';

	/**
	 * The article tuning panel, preview only. Registers a folder into the
	 * `DialsHost` mounted from the root layout, and goes with the route. Nothing
	 * persists; what settles is copied into `ARTICLE_DEFAULTS` and `app.css`.
	 */

	const dials = createDialKit('Article', {
		links: {
			underline: ARTICLE_DEFAULTS.underline,
			underlineOffset: [ARTICLE_DEFAULTS.underlineOffset, 0, 8, 0.5],
			underlineThickness: [ARTICLE_DEFAULTS.underlineThickness, 0.5, 4, 0.5]
		},
		text: {
			bodySize: [ARTICLE_DEFAULTS.bodySize, 0.8, 1.5, 0.01],
			leading: [ARTICLE_DEFAULTS.leading, 1.2, 2.2, 0.025],
			// 0 means the full column the layout gives it, which is what
			// `max-w-none` does today. Anything above ~45 is a real measure.
			measure: [ARTICLE_DEFAULTS.measure, 0, 100, 1]
		}
	});

	$effect(() => {
		Object.assign(articleSettings, dials.links, dials.text);
	});
</script>
