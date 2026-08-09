<script>
	import { DialRoot } from 'dialkit/svelte';
	import 'dialkit/styles.css';
	import { readDialsOpen, writeDialsOpen } from '$lib/dev/dials-open.js';

	/**
	 * The one `<DialRoot />` for the whole site, and nothing else.
	 *
	 * Mounted from the root layout through `DialsMount.svelte`, so the overlay
	 * exists on every public page. It deliberately registers no controls of its
	 * own: a site-wide panel meant tuning tokens that only some pages actually
	 * show, which is how you end up with sliders that appear to do nothing. Every
	 * control now lives on the page it affects — `HomeDials`, `ArticleDials`,
	 * `HealthDials` — and each registers into this overlay as a folder that comes
	 * and goes with the route.
	 */

	// Read once, at mount. `defaultOpen` is what `DialRoot` hands a panel that
	// has no open state yet, and the per-route panels register (and re-register
	// on every navigation) after this component exists — so a collapsed panel
	// stays collapsed across refreshes and route changes alike. Only the open
	// state is stored; the dial *values* still reset, and what settles is copied
	// into the `*_DEFAULTS` and `app.css` by hand.
	const defaultOpen = readDialsOpen();
</script>

<!-- `productionEnabled`, because DialKit hides itself when `NODE_ENV` is
     `production` — and a Vercel preview is a production build of the app, just
     deployed somewhere else. The gate that matters is `__DIALS__`: if this
     component exists at all, the build already decided the panel belongs. -->
<DialRoot
	position="bottom-right"
	theme="system"
	productionEnabled
	{defaultOpen}
	onOpenChange={writeDialsOpen}
/>
