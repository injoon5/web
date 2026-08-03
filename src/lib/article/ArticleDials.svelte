<script>
	import { createDialKit } from 'dialkit/svelte';
	import { ARTICLE_DEFAULTS, articleSettings } from '$lib/article/article-settings.svelte.js';

	/**
	 * The article tuning panel, on preview deployments only.
	 *
	 * Reached through a dynamic import behind `__DIALS__` in
	 * `ArticleDialsMount.svelte`, so a production build folds it away entirely.
	 * It registers a folder into the overlay `DialsHost` already mounted from the
	 * root layout, and disappears again when the route changes.
	 *
	 * The controls are the four arguments worth having about body text — whether
	 * links are underlined and how heavily, how far apart the lines sit, how big
	 * they are, and how wide the column runs — and all four are unanswerable
	 * without a real paragraph in front of you. Nothing persists: what settles
	 * gets copied into `ARTICLE_DEFAULTS` and `app.css` by hand.
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
