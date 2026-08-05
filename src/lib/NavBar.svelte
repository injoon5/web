<script>
	import { page } from '$app/state';
	import { createWebHaptics } from 'web-haptics/svelte';
	import { onMount, onDestroy } from 'svelte';
	import { heroNameVisible } from '$lib/heroNav.js';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import NavDialsMount from '$lib/NavDialsMount.svelte';
	import { navSettings, navStyle } from '$lib/nav-settings.svelte.js';

	const { trigger, destroy } = createWebHaptics();
	onDestroy(destroy);

	let mounted = $state(false);
	let menuOpen = $state(false);

	// The surface arrives as the page moves under it, and it is CSS that watches
	// the page move: a scroll-driven animation on the shell carries
	// `--nav-surface-scroll` from 0 to 1 across the first stretch of the document,
	// and the surface and the hairline read it. Nothing runs per frame, and
	// nothing runs on the main thread.
	//
	// `scrolled` is only the fallback for a browser without scroll timelines,
	// where the listener below flips it once past the same threshold and the tint
	// switches on over 200ms the way it always has. It is left `false` everywhere
	// else, and the rule it drives is overridden by the animation regardless —
	// what the check actually buys is not installing the listener at all.
	let scrolled = $state(false);
	let scrollLinked = $state(false);

	// How far past the row the header reaches while open, which is what the one
	// surface and the one hairline grow by. The band's own height is measured
	// rather than asserted — it is a row of type, and its height is the font's to
	// decide — and a negative lead is the band riding up into the row, so it
	// comes off the total.
	let moreRowHeight = $state(0);
	let openExtra = $derived(menuOpen ? moreRowHeight + Math.min(0, navSettings.lead) : 0);

	// The row's height is a page-wide token, not the header's private business:
	// `--nav-h` in `app.css` is what keeps a `#hash` link from landing its heading
	// under this bar, and what the table of contents sticks below. That file
	// carries the shipped number statically, because the browser scrolls to a
	// deep link while the document is still parsing — this only re-publishes the
	// height once there is a real one to measure, so a row set taller by the
	// dials, or by type that renders differently than it was tuned against, takes
	// the anchor offset with it instead of leaving it a stale constant.
	let rowHeight = $state(0);
	$effect(() => {
		if (!rowHeight) return;
		document.documentElement.style.setProperty('--nav-h', `${rowHeight}px`);
	});

	// Two tiers, not four links that shrink to fit. Everything below `sm` shows
	// the primary pair plus a disclosure; `sm` and up shows all four inline.
	const navItems = [
		{ label: 'projects', href: '/projects' },
		{ label: 'blog', href: '/blog' }
	];
	const moreItems = [
		{ label: 'now', href: '/now' },
		{ label: 'health', href: '/health' }
	];

	/** @type {HTMLElement | undefined} */
	let root = $state();
	/** @type {HTMLButtonElement | undefined} */
	let toggleEl = $state();

	// On the home page the hero owns the name, so the navbar name stays hidden
	// until the hero scrolls out of view (tracked by heroNameVisible). Every
	// other page shows it immediately.
	let isHome = $derived(page.url.pathname === '/');
	let showName = $derived(!isHome || !$heroNameVisible);

	function isActive(href) {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(href);
	}

	// With the menu shut, the chevron is the only thing standing in for /now and
	// /health, so it carries their active state.
	let moreActive = $derived(moreItems.some((item) => isActive(item.href)));

	function toggle() {
		trigger([{ duration: 25 }], { intensity: 0.7 });
		menuOpen = !menuOpen;
	}

	// Navigating anywhere — including from inside the menu — puts it away.
	$effect(() => {
		page.url.pathname;
		menuOpen = false;
	});

	// Dismissal is only wired up while the menu is actually open, so the closed
	// nav costs nothing per scroll frame.
	$effect(() => {
		if (!menuOpen) return;

		const openedAt = window.scrollY;

		/** @param {PointerEvent} event */
		function onPointerDown(event) {
			if (root?.contains(/** @type {Node} */ (event.target))) return;
			menuOpen = false;
		}

		function onScroll() {
			// A tap on iOS can drift a pixel or two before the pointer settles;
			// only a deliberate scroll should dismiss.
			if (Math.abs(window.scrollY - openedAt) > 6) menuOpen = false;
		}

		/** @param {KeyboardEvent} event */
		function onKeydown(event) {
			if (event.key !== 'Escape') return;
			menuOpen = false;
			toggleEl?.focus();
		}

		// Capture, so a click on something that stops propagation still dismisses.
		window.addEventListener('pointerdown', onPointerDown, true);
		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('keydown', onKeydown);

		return () => {
			window.removeEventListener('pointerdown', onPointerDown, true);
			window.removeEventListener('scroll', onScroll);
			window.removeEventListener('keydown', onKeydown);
		};
	});

	function onWindowScroll() {
		scrolled = window.scrollY > 8;
	}

	onMount(() => {
		mounted = true;

		// Where the surface can track the scroll position in CSS, the header wants
		// no scroll listener of its own — this is the only one the closed nav ever
		// installed, and it ran on every scroll event on every page.
		scrollLinked = CSS.supports('animation-timeline', 'scroll()');
		if (!scrollLinked) {
			onWindowScroll();
			window.addEventListener('scroll', onWindowScroll, { passive: true });
		}

		// The panel is `sm:hidden`, so a widened viewport would leave menuOpen
		// stuck true and the header surface opaque with nothing to show for it.
		const mq = window.matchMedia('(min-width: 40rem)');
		const onChange = () => {
			if (mq.matches) menuOpen = false;
		};
		mq.addEventListener('change', onChange);

		return () => {
			window.removeEventListener('scroll', onWindowScroll);
			mq.removeEventListener('change', onChange);
		};
	});
</script>

<!-- Without scripting the toggle is a dead control and /now + /health would be
     unreachable from a phone, so the panel drops back into flow permanently and
     the header stops sticking — and a transparent bar over scrolling text is
     worse than a bar that scrolls away. The surface has to be sent away with it:
     the scroll-driven animation needs no script, so it would otherwise go on
     tinting a header that is no longer over anything. `inert` is only ever
     applied after mount, and these rules outrank the collapsed utilities on
     specificity alone. -->
<svelte:head>
	<noscript>
		<style>
			#site-nav {
				position: static;
				animation-name: none;
			}
			#nav-more-toggle {
				display: none;
			}
			#nav-more {
				position: static;
				grid-template-rows: 1fr;
			}
			#nav-more a {
				opacity: 1;
				translate: none;
			}
		</style>
	</noscript>
</svelte:head>

<!-- The header's priority order, expressed as layout rather than hoped for: type
     never shrinks on a small screen — the link set does. Below `sm` the nav is
     'projects blog ⌄' and /now + /health live one tap down; the wordmark still
     gets `min-w-0` so it, not the links, is what gives way at 320px.

     The sticky shell and its surface live here rather than in the layout because
     the disclosure has to be part of that surface: only the row is in flow, and
     the panel hangs off `top-full` so opening the menu draws over the page
     instead of pushing every page down by its height. -->
<!-- `--nav-open-extra` is how far past the row the header currently reaches, and
     it is what the one surface grows by. The tuning properties beside it are only
     written where the panel exists: in production `__DIALS__` is a literal
     `false`, so only the first one is emitted and every rule below falls back to
     the value its Tailwind class also carries. -->
<div
	bind:this={root}
	id="site-nav"
	class="nav-shell sticky top-0 z-30"
	data-home={isHome}
	data-menu-open={menuOpen}
	data-scrolled={!scrollLinked && scrolled}
	style="--nav-open-extra:{openExtra}px{__DIALS__ ? ';' + navStyle() : ''}"
>
	<div class="relative">
		<!-- One surface for the whole header, grown from the bottom, rather than one
		     per row. Two adjacent backdrop-filter layers each clamp their blur at
		     the shared edge, so neither pulls in what is behind the other and the
		     seam paints as a visible step in the tint — measured at five levels over
		     a dark page, which is exactly the width of the disclosure. -->
		<!-- Both layers are painted at full strength and faded as a whole, rather
		     than having their colour swapped between two alpha values. It is the
		     blur that makes this worth doing: `backdrop-blur-md` used to be on from
		     the top of the page, doing its work behind a fully transparent tint, and
		     fading the element takes the filter with it — so a header sitting over
		     nothing composites nothing. -->
		<div
			aria-hidden="true"
			class="nav-surface absolute inset-0 -z-10 bg-white/70 backdrop-blur-md dark:bg-neutral-950/70"
		></div>
		<!-- And one hairline, which slides down to the new bottom edge as the
		     disclosure opens instead of a second one fading in beneath it. -->
		<div
			aria-hidden="true"
			class="nav-hairline absolute inset-x-0 bottom-0 h-px bg-neutral-200/70 dark:bg-neutral-800/70"
		></div>
		<!-- Centred, so the name and the links hang from one middle axis rather than
		     standing on one baseline — small links sharing a baseline with type this
		     much larger read as sitting on the floor beside it.

		     Centring is exactly the middle axis here, not an approximation of it:
		     Interlude's cap height equals its ascent minus its descent, which puts a
		     line box's centre on its own cap band's centre at any size. So the
		     wordmark's caps and the links' caps land on one axis, 3px off a shared
		     baseline, which is the trade being made deliberately. -->
		<nav
			bind:clientHeight={rowHeight}
			class="nav-row mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-12"
		>
			<a
				href="/"
				onclick={() => trigger([{ duration: 35 }], { intensity: 1 })}
				aria-label="Home — Injoon Oh"
				class="group inline-flex min-w-0 items-center {showName ? '' : 'pointer-events-none'}"
			>
				<!-- The wordmark's presence is carried by the wrapper, not by the type
				     inside it. That is what leaves the hover cross-fade underneath
				     untouched: the two spans go on trading places on their own
				     `opacity`, and whatever the wrapper is at multiplies through both.
				     A scroll-driven animation on the English span's own `opacity`
				     would have taken the property away from `group-hover:opacity-0`
				     outright, and hovering the wordmark would have stopped doing
				     anything on the one page this animation runs on. -->
				<span
					class="nav-name relative block min-w-0"
					data-shown={!isHome || showName}
					data-animate={mounted}
				>
					<span
						class="block truncate font-sans text-2xl font-medium tracking-tight will-change-auto group-hover:opacity-0 group-hover:blur-sm
					{mounted ? 'transition-[opacity,filter] duration-200 ease-out' : ''}"
					>
						Injoon Oh
					</span>
					<span
						class="pointer-events-none absolute inset-0 block truncate font-sans text-2xl font-semibold tracking-tight opacity-0 blur-sm transition-[opacity,filter] duration-200 ease-out will-change-auto group-hover:opacity-100 group-hover:blur-none"
					>
						오인준
					</span>
				</span>
			</a>

			<!-- No gap of its own: the chevron's box already carries 14.7px of blank
			     to the left of its ink, which is the gap. -->
			<div class="nav-cluster flex shrink-0 items-center gap-0 sm:gap-4">
				<ul class="nav-links flex items-center gap-3 sm:gap-4">
					{#each navItems as item (item.href)}
						<li>
							<a
								href={item.href}
								onclick={() => trigger([{ duration: 25 }], { intensity: 0.7 })}
								class="-my-2 px-0 py-2 text-base font-medium transition-colors duration-150 md:px-1 {isActive(
									item.href
								)
									? 'text-neutral-900 dark:text-neutral-100'
									: 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-100'}"
								aria-current={isActive(item.href) ? 'page' : 'false'}
							>
								{item.label}
							</a>
						</li>
					{/each}
					{#each moreItems as item (item.href)}
						<li class="hidden sm:block">
							<a
								href={item.href}
								onclick={() => trigger([{ duration: 25 }], { intensity: 0.7 })}
								class="-my-2 px-0 py-2 text-base font-medium transition-colors duration-150 md:px-1 {isActive(
									item.href
								)
									? 'text-neutral-900 dark:text-neutral-100'
									: 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-100'}"
								aria-current={isActive(item.href) ? 'page' : 'false'}
							>
								{item.label}
							</a>
						</li>
					{/each}
				</ul>

				<!-- The ink is what aligns, not the box. A 40px tap target holds an 18px
				     icon whose drawn chevron is inset another 4.5px inside that, so the
				     mark ended up 6.7px shy of the right margin every other line on the
				     page sits on. -15px pulls it flush (the round cap's 0.8px overhang
				     is deliberate — a tapering mark needs it to read as aligned). -->
				<button
					bind:this={toggleEl}
					id="nav-more-toggle"
					type="button"
					onclick={toggle}
					aria-expanded={menuOpen}
					aria-controls="nav-more"
					aria-label={menuOpen ? 'Hide more pages' : 'More pages'}
					class="nav-toggle -my-2 -mr-[15px] inline-flex h-10 w-10 items-center justify-center transition-colors duration-150 sm:hidden {menuOpen ||
					moreActive
						? 'text-neutral-900 dark:text-neutral-100'
						: 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-100'}"
				>
					<ChevronDown
						size={navSettings.chevronSize}
						strokeWidth={navSettings.chevronStroke}
						class="nav-chevron {menuOpen ? 'rotate-180' : 'rotate-0'}"
						aria-hidden="true"
					/>
				</button>
			</div>
		</nav>
	</div>

	<!-- 0fr → 1fr rather than a measured max-height: the row grows to exactly what
	     is in it, whatever the type metrics turn out to be. `inert` keeps the
	     collapsed links off the tab order and out of the accessibility tree. -->
	<div
		id="nav-more"
		inert={mounted && !menuOpen}
		class="nav-more absolute inset-x-0 top-full grid sm:hidden {mounted
			? 'nav-more-animate'
			: ''} {menuOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}"
	>
		<!-- Nothing painted in here — the header's surface and hairline both belong
		     to the shell above, which grows over this. All this does is clip the
		     links while the row is collapsed. -->
		<div class="min-h-0 overflow-hidden">
			<!-- Spacing set off the baselines, not the boxes. This row's baseline sits
			     30px under the row above, which is 10px tighter than their line boxes
			     sitting flush would allow — see `.nav-more`, which rides the band up
			     into padding the row above is not using. Close enough that the two
			     read as one list rather than two bands. 16px below leaves the same
			     21px from baseline to hairline that the closed header already has, so
			     opening the menu moves that rule without changing its relationship to
			     the type. Same 12px word gap as the row above.

			     41px on the right is the 16px page gutter plus the 25px of the
			     chevron's tap target that sits inside the row — its 40px box less the
			     15px it hangs past the margin. That is what ends this row on 'blog',
			     rather than out under the chevron on the page margin. -->
			<ul
				bind:clientHeight={moreRowHeight}
				class="nav-more-row mx-auto flex max-w-6xl items-center justify-end gap-3 pt-0 pr-[41px] pb-4 pl-4"
			>
				{#each moreItems as item, i (item.href)}
					<li>
						<a
							href={item.href}
							onclick={() => trigger([{ duration: 25 }], { intensity: 0.7 })}
							style="transition-delay: {menuOpen
								? navSettings.staggerBase + i * navSettings.staggerStep
								: 0}ms"
							class="nav-more-link -my-2 py-2 text-base font-medium {menuOpen
								? 'translate-y-0 opacity-100'
								: '-translate-y-1 opacity-0'} {isActive(item.href)
								? 'text-neutral-900 dark:text-neutral-100'
								: 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-100'}"
							aria-current={isActive(item.href) ? 'page' : 'false'}
						>
							{item.label}
						</a>
					</li>
				{/each}
			</ul>
		</div>
	</div>
</div>

<NavDialsMount />

<style>
	/* Everything the DialKit panel can move, each falling back to the value its
	   Tailwind class carries — so a build with the panel folded away sets none of
	   these and renders exactly what the classes say. The row's overrides that
	   have `sm` variants are held below that breakpoint for the same reason: the
	   dial is for the phone header, and it must not quietly flatten the wider
	   spacing the desktop row is written with. */
	.nav-row {
		align-items: var(--nav-align, center);
		padding-block: var(--nav-row-pad-y, 0.75rem);
	}

	.nav-cluster {
		translate: 0 var(--nav-cluster-nudge, 0px);
	}

	/* The lead changes form at zero, because padding cannot go negative and zero
	   is not the tightest these two lines can be set. Opening it up pads the row
	   inside the band; closing it past flush moves the whole band instead, and the
	   second line rides up into the row's bottom padding and into the slack the
	   24px wordmark leaves around the 16px links — all of it empty. Either way
	   everything below the line comes with it, so its own spacing and the
	   hairline's distance from it hold at any lead. */
	.nav-more {
		margin-top: min(0px, var(--nav-more-lead, -10px));
	}

	/* How present the surface is, from the two things that have an opinion about
	   it: how far the page has scrolled under the header, and whether the
	   disclosure is hanging open. They have to compose rather than take turns —
	   opening the menu at the top of a page and opening it halfway down are the
	   same header, and the surface must not drop back to a scroll-derived value
	   when the menu closes, nor jump to full when it opens over a page that has
	   already tinted it.

	   `max()` is that composition, and it is why these are registered properties
	   rather than an animated `opacity`: an animation wins over any declaration
	   for the property it runs on, so a scroll-driven `opacity` would have left
	   the open menu nothing to say. Each input carries its own timing instead —
	   one tied to the scrollbar, one to a 200ms transition — and the surface reads
	   whichever is asking for more. */
	@property --nav-surface-scroll {
		syntax: '<number>';
		inherits: true;
		initial-value: 0;
	}

	@property --nav-surface-menu {
		syntax: '<number>';
		inherits: true;
		initial-value: 0;
	}

	@keyframes nav-surface-progress {
		from {
			--nav-surface-scroll: 0;
		}
		to {
			--nav-surface-scroll: 1;
		}
	}

	.nav-shell {
		transition:
			--nav-surface-scroll 200ms ease,
			--nav-surface-menu 200ms ease;
	}

	.nav-shell[data-menu-open='true'] {
		--nav-surface-menu: 1;
	}

	/* The fallback, and the only thing the scroll listener drives: the same
	   threshold, arriving all at once over the same 200ms it always did. Where the
	   animation below runs it overrides this outright — a property an animation is
	   holding takes neither a declaration nor a transition — which is what lets the
	   listener simply not be installed. */
	.nav-shell[data-scrolled='true'] {
		--nav-surface-scroll: 1;
	}

	@supports (animation-timeline: scroll()) {
		/* The surface stops being a state the header holds and becomes a reading of
		   where the page is: the tint and the hairline arrive over the first
		   `--nav-surface-range` of scroll, in step with the gesture rather than
		   switched on 8px into it. Nothing observes the scroll to do it — no
		   listener, no observer, nothing on the main thread per frame. */
		.nav-shell {
			animation: nav-surface-progress linear both;
			animation-timeline: scroll(root block);
			animation-range: 0px var(--nav-surface-range, 64px);
		}

		/* A tint that tracks the scrollbar is not motion — it is the page moving,
		   which is the one thing this preference does not ask anyone to stop. The
		   global reduce rule collapses every `animation-duration` to 0.001ms, and
		   `auto` is what a progress timeline wants there. */
		@media (prefers-reduced-motion: reduce) {
			.nav-shell {
				animation-duration: auto !important;
			}
		}
	}

	/* The wordmark, which on the home page is the second half of a handover: the
	   hero owns the name until it goes behind the header, and then the header
	   does. It reads the hero's own view progress to know where in that it is —
	   `--nav-hero-name`, declared on the hero and hoisted by `timeline-scope` on
	   `:root` — so the fade is a function of where the page is, not of a clock
	   started when a threshold was crossed. Stop scrolling halfway and it stops
	   halfway; scroll back up and it goes back.

	   `exit` is the phase where the hero name is leaving at the top, and the
	   timeline's own inset puts that edge at the bottom of the header rather than
	   the top of the viewport. So the range is exactly the 32px over which the
	   hero name disappears — 0 when its cap line reaches the bar, 1 when its
	   baseline has passed under it. The whole range, `linear`, and no offset on
	   either end: however much of the hero name has gone under the bar is however
	   much of this one has arrived, and that one-to-one is the point of it. There
	   is deliberately no dial for the range — a knob here is a knob for taking
	   the two names out of step.

	   `opacity` and `translate` are both composited, and this is the only thing
	   asking for either on this element, so the whole handover runs off the main
	   thread. Every other option — a custom property composed with `max()` the
	   way the surface is, an animated `filter` — would have pulled it back onto
	   the main thread for a fade that has nothing to compose with. */
	.nav-name {
		opacity: 1;
		translate: 0 0;
	}

	/* Where there is no view timeline to read, the observer's binary is still
	   what it was: a 200ms fade once the hero has gone. Held off until mount so
	   the home page does not animate its own first paint. */
	.nav-name[data-shown='false'] {
		opacity: 0;
		translate: 0 0.25rem;
	}

	.nav-name[data-animate='true'] {
		transition:
			opacity 200ms ease-out,
			translate 200ms ease-out;
	}

	@keyframes nav-name-in {
		from {
			opacity: 0;
			translate: 0 0.25rem;
		}
		to {
			opacity: 1;
			translate: 0 0;
		}
	}

	@supports (animation-timeline: view()) {
		/* Gated on the home page rather than left to an unresolved timeline name:
		   `timeline-scope` keeps the name in existence everywhere it is scoped,
		   inactive rather than absent, and an inactive timeline is not something
		   to have the wordmark's visibility on every other page depend on. */
		.nav-shell[data-home='true'] .nav-name {
			animation: nav-name-in linear both;
			animation-timeline: --nav-hero-name;
			animation-range: exit;
		}

		@media (prefers-reduced-motion: reduce) {
			.nav-shell[data-home='true'] .nav-name {
				animation-duration: auto !important;
			}
		}
	}

	/* The surface and the hairline are sized by the row and then stretched past it
	   by however far the disclosure currently reaches, so one blurred pane covers
	   the whole header at every point in the animation. They ease on the same
	   curve and duration as the row that is pushing them.

	   Their own presence is not transitioned here: it is already carried by the
	   two properties above, and a transition on top of a scroll-driven value would
	   only make it lag the finger. */
	.nav-surface,
	.nav-hairline {
		opacity: max(var(--nav-surface-scroll), var(--nav-surface-menu));
		bottom: calc(-1 * var(--nav-open-extra, 0px));
		transition: bottom var(--nav-duration, 320ms) var(--nav-ease);
	}

	.nav-more-row {
		padding-top: max(0px, var(--nav-more-lead, -10px));
		padding-right: var(--nav-more-pad-r, 41px);
		padding-bottom: var(--nav-more-pad-b, 1rem);
		gap: var(--nav-more-gap, 0.75rem);
	}

	@media (max-width: 39.99rem) {
		.nav-links {
			gap: var(--nav-word-gap, 0.75rem);
		}

		.nav-toggle {
			margin-right: calc(-1 * var(--nav-toggle-overhang, 15px));
		}
	}

	/* The site's own ease-out tokens are steep enough that 90% of a 320ms move is
	   over in ~110ms — right for a colour or a 4px nudge, but it makes a header
	   that grows by 50px read as a jump cut. This curve carries more of its
	   distance through the middle of the duration, so the growth is legible
	   without feeling slow. */
	.nav-shell,
	:global(.nav-chevron) {
		--nav-ease: cubic-bezier(0.32, 0.72, 0, 1);
	}

	/* Held off until mount so a page that loads with the menu shut doesn't
	   animate open from 0fr on hydration. */
	.nav-more-animate {
		transition: grid-template-rows var(--nav-duration, 320ms) var(--nav-ease);
	}

	/* `translate` and `rotate`, never `transform`: Tailwind v4 compiles its
	   translate and rotate utilities to those standalone properties, so a
	   transition naming `transform` animates nothing at all — the element just
	   snaps to its new position while whatever else is in the list eases. */
	.nav-more-link {
		transition:
			opacity var(--nav-link-duration, 260ms) var(--nav-ease),
			translate var(--nav-link-duration, 260ms) var(--nav-ease),
			color 150ms ease;
	}

	:global(.nav-chevron) {
		transition: rotate var(--nav-duration, 320ms) var(--nav-ease);
	}

	/* The global reduce rule collapses durations but not delays, which would
	   otherwise hold the second link blank for ~95ms after the row has grown. */
	@media (prefers-reduced-motion: reduce) {
		.nav-more-link {
			transition-delay: 0ms !important;
		}
	}
</style>
