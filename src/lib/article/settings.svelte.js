/**
 * How an article's body text is set.
 *
 * Shipped values, read by the `[slug]` pages and written by nothing in
 * production — on preview deployments `ArticleDials.svelte` binds a DialKit
 * panel to this object, so the sliders move real prose rather than a specimen.
 *
 * They reach the DOM as custom properties on the `.prose-post` wrapper, and
 * every rule in `app.css` that reads one keeps the Tailwind value it replaced as
 * its fallback — so an untouched page renders exactly as before.
 */

export const ARTICLE_DEFAULTS = {
	/** Underlined links, as the typography plugin has them. */
	underline: true,
	/** Gap between the baseline and the rule, in px. Was `underline-offset-2`. */
	underlineOffset: 2,
	/** Rule weight, in px. Was `decoration-1`. */
	underlineThickness: 1,
	/**
	 * Body line-height. `prose-p:leading-relaxed` is 1.625, and the right value
	 * for a measure this wide is worth arguing about against real paragraphs.
	 */
	leading: 1.625,
	/** Body size in rem. The plugin's `prose` base is 1rem. */
	bodySize: 1,
	/**
	 * Column width in `ch`, or 0 for the full column the layout gives it —
	 * which is what `max-w-none` currently does. The single biggest lever on
	 * whether long-form actually reads.
	 */
	measure: 0
};

export const articleSettings = $state({ ...ARTICLE_DEFAULTS });

/** The settings as one `style` string for the `.prose-post` wrapper. */
export function articleStyle(s = articleSettings) {
	return [
		`--prose-underline:${s.underline ? 'underline' : 'none'}`,
		`--prose-underline-offset:${s.underlineOffset}px`,
		`--prose-underline-thickness:${s.underlineThickness}px`,
		`--prose-leading:${s.leading}`,
		`--prose-size:${s.bodySize}rem`,
		`--prose-measure:${s.measure > 0 ? `${s.measure}ch` : 'none'}`
	].join(';');
}
