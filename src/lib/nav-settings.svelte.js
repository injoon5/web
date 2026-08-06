/**
 * The numbers the header is set with.
 *
 * Shipped values, read by `NavBar.svelte` and written by nothing in production —
 * on preview deployments and in `vite dev`, `NavDials.svelte` binds a DialKit
 * panel to this same object, so the sliders move the real header.
 *
 * Everything here is a typographic relationship rather than a look: where the
 * two rows' marks sit relative to each other, how far the second row hangs
 * below the first, and where the chevron's ink falls against the page margin.
 * None of those can be judged from a number — they have to be seen against the
 * actual type at the actual size, which is what a slider is for.
 *
 * They reach the DOM as custom properties on the header, and every rule that
 * reads one keeps its shipped value as the fallback, so a build with the panel
 * folded away renders exactly what it renders today.
 */

export const NAV_ALIGNMENTS = ['center', 'baseline'];

export const NAV_DEFAULTS = {
	/**
	 * `center` hangs the name and the links from one middle axis; `baseline`
	 * stands them on one baseline. They are 3px apart in this typeface and there
	 * is no third option — cap height equals ascent minus descent here, so a
	 * centred line box is already centred on its own cap band.
	 */
	align: 'center',
	/** Nudges the whole right-hand cluster off that axis, in px. */
	clusterNudge: 0,

	/** Row padding above and below the type, in px. Was `py-3`. */
	rowPadY: 12,
	/** Space between links in the row, below `sm`. Was `gap-3`. */
	wordGap: 12,
	/**
	 * How far the chevron's 40px tap target hangs past the right margin, in px.
	 * Its drawn mark sits ~14.7px inside that box, so this is what decides
	 * whether the ink lands on the margin the body text uses.
	 */
	toggleOverhang: 15,
	/** The chevron itself. Passed to the icon, not to CSS. */
	chevronSize: 18,
	chevronStroke: 2.25,

	/**
	 * The space between the header's two lines, as an offset in px from where
	 * their line boxes sit flush — which is 40px baseline to baseline, so `lead`
	 * plus 40 is the real distance. -10 puts the two lines 30px apart.
	 *
	 * It goes negative because flush is not the tightest the two lines can be
	 * set: the first row's line box is sized by the 24px wordmark while its links
	 * only need 24px of the 32, and there is another 12px of row padding under
	 * that. All of it is empty, and the second line is free to ride up into it.
	 * That moves the whole band, so the space under the second line and the
	 * hairline's distance from it do not change with this.
	 */
	lead: -10,
	/** Space under the disclosure row, down to the hairline, in px. */
	padBottom: 16,
	/**
	 * Right padding on the disclosure row, in px. 41 = the 16px page gutter plus
	 * the 25px of the toggle that falls inside the row, which is what ends the
	 * row on 'blog' rather than out on the page margin under the chevron.
	 */
	padRight: 41,
	/** Space between the disclosure's links, in px. */
	moreGap: 12,

	/**
	 * How much scrolling it takes for the surface to arrive, in px. Not a
	 * duration: the tint and the hairline are on a scroll timeline, so this is a
	 * distance down the page, and the only thing that decides whether the header
	 * settles onto the page or is dragged onto it.
	 */
	surfaceRange: 64,
	/**
	 * How deep the soft lower lip of the wordmark's window is, in px — the band
	 * the name dissolves through on its way in rather than being cut off by. It
	 * sits under the line box, in the row's own bottom padding, so 12 is as far
	 * as it can go before it reaches the hairline. 0 is a hard clip.
	 */
	namePortal: 12,

	/** Panel growth and chevron rotation, in ms. */
	duration: 320,
	/** Each link's fade and slide, in ms. */
	linkDuration: 260,
	/** Delay on the first link, and the step to each one after it, in ms. */
	staggerBase: 40,
	staggerStep: 55
};

export const navSettings = $state({ ...NAV_DEFAULTS });

/**
 * The settings as a `style` string for the header element. Only ever applied
 * behind `__DIALS__` — production sets no custom properties at all and every
 * rule falls back to the same numbers.
 */
export function navStyle(s = navSettings) {
	return [
		`--nav-align:${s.align}`,
		`--nav-cluster-nudge:${s.clusterNudge}px`,
		`--nav-row-pad-y:${s.rowPadY}px`,
		`--nav-word-gap:${s.wordGap}px`,
		`--nav-toggle-overhang:${s.toggleOverhang}px`,
		`--nav-more-lead:${s.lead}px`,
		`--nav-more-pad-b:${s.padBottom}px`,
		`--nav-more-pad-r:${s.padRight}px`,
		`--nav-more-gap:${s.moreGap}px`,
		`--nav-surface-range:${s.surfaceRange}px`,
		`--nav-name-portal:${s.namePortal}px`,
		`--nav-duration:${s.duration}ms`,
		`--nav-link-duration:${s.linkDuration}ms`
	].join(';');
}
