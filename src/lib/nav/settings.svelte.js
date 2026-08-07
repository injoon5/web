/**
 * The numbers the header is set with. Production reads them and writes nothing;
 * on preview and in `vite dev`, `NavDials.svelte` binds a DialKit panel to this
 * same object so the sliders move the real header.
 *
 * They reach the DOM as custom properties, and every rule that reads one keeps
 * its shipped value as the fallback — so a build with the panel folded away
 * renders exactly what it renders today.
 */

export const NAV_ALIGNMENTS = ['center', 'baseline'];

export const NAV_DEFAULTS = {
	/** `center` hangs name and links from one middle axis; `baseline` stands them on one. */
	align: 'center',
	/** Nudges the whole right-hand cluster off that axis, in px. */
	clusterNudge: 0,

	/** Row padding above and below the type, in px. */
	rowPadY: 12,
	/** Space between links in the row, below `sm`. */
	wordGap: 12,
	/**
	 * How far the chevron's 40px tap target hangs past the right margin, in px.
	 * Its drawn mark sits ~14.7px inside that box, so this decides whether the ink
	 * lands on the margin the body text uses.
	 */
	toggleOverhang: 15,
	/** The chevron itself. Passed to the icon, not to CSS. */
	chevronSize: 18,
	chevronStroke: 2.25,

	/**
	 * Space between the header's two lines, as an offset in px from where their
	 * line boxes sit flush — flush is 40px baseline to baseline, so -10 sets them
	 * 30px apart. Negative is valid: the first row's line box is sized by the 24px
	 * wordmark while its links need 24 of the 32, and the second line rides up
	 * into the slack. That moves the whole band, so the space below it is unchanged.
	 */
	lead: -10,
	/** Space under the disclosure row, down to the hairline, in px. */
	padBottom: 16,
	/**
	 * Right padding on the disclosure row, in px. 41 = the 16px page gutter plus
	 * the 25px of the toggle that falls inside the row, which ends the row on
	 * 'blog' rather than out under the chevron.
	 */
	padRight: 41,
	/** Space between the disclosure's links, in px. */
	moreGap: 12,

	/** How far down the page the surface takes to arrive, in px — a distance, not a duration. */
	surfaceRange: 64,
	/**
	 * Depth of the soft lower lip of the wordmark's window, in px — the band the
	 * name dissolves through rather than being clipped by. Opened below the type's
	 * own line, so the resting name is never touched at any depth. Past 12 it hangs
	 * below the hairline, which only shows while the name is moving. 0 is a hard clip.
	 */
	namePortal: 20,

	/** Panel growth and chevron rotation, in ms. */
	duration: 320,
	/** Each link's fade and slide, in ms. */
	linkDuration: 260,
	/** Delay on the first link, and the step to each one after it, in ms. */
	staggerBase: 40,
	staggerStep: 55
};

export const navSettings = $state({ ...NAV_DEFAULTS });

/** The settings as a `style` string. Only ever applied behind `__DIALS__`. */
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
