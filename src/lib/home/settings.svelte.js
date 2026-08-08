/**
 * The numbers the home page's two media sections are drawn with.
 *
 * Shipped values, read by `+page.svelte` and written by nothing in production —
 * on preview deployments `HomeDials.svelte` binds a DialKit panel to this same
 * object, so the sliders move the real marquee and the real photo grid.
 *
 * They reach the DOM as custom properties on each section, which is what lets a
 * Tailwind-classed page be tuned without unpicking it into inline styles: the
 * class stays, and the one value worth moving comes from a variable.
 */

export const HOME_DEFAULTS = {
	/**
	 * Marquee travel in px/s. Set on the track and read by `marqueeConstantSpeed`,
	 * which sizes the animation by distance rather than item count so the speed
	 * holds however many tracks Last.fm returns.
	 */
	marqueeSpeed: 40,
	/** Album cover edge, in rem. Was `w-40` / `lg:w-48`. */
	coverSize: 10,
	coverSizeLg: 12,
	/** Space between covers, in rem. Was `mr-3`. */
	coverGap: 1,
	/** Corner radius shared by covers and photos, in rem. Was `rounded-xl`. */
	radius: 0.75,
	/**
	 * How dark the scrim under a cover's title gets. The title is white, so this
	 * is the contrast floor — worth being able to see moved against real art
	 * rather than guessed at.
	 */
	scrim: 0.7,
	/** Photos per row from `sm` up, and how many are shown at all. */
	photoColumns: 3,
	photoCount: 6,
	/** Space between photos, in rem. Was `gap-4`. */
	photoGap: 1
};

export const homeSettings = $state({ ...HOME_DEFAULTS });

/**
 * The settings as a `style` string, so a section can hand them to CSS in one
 * binding. Every rule that reads these keeps the original value as its
 * fallback, so the page renders identically if nothing is ever set.
 */
export function homeStyle(s = homeSettings) {
	return [
		`--marquee-speed:${s.marqueeSpeed}`,
		`--cover-size:${s.coverSize}rem`,
		`--cover-size-lg:${s.coverSizeLg}rem`,
		`--cover-gap:${s.coverGap}rem`,
		`--media-radius:${s.radius}rem`,
		`--cover-scrim:${s.scrim}`,
		`--photo-columns:${s.photoColumns}`,
		`--photo-gap:${s.photoGap}rem`
	].join(';');
}
