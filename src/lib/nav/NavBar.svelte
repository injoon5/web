<script>
	import { page } from '$app/state';
	import { createWebHaptics } from 'web-haptics/svelte';
	import { onMount, onDestroy } from 'svelte';
	import { heroName } from '$lib/nav/hero.svelte.js';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import NavDialsMount from '$lib/nav/NavDialsMount.svelte';
	import { navSettings, navStyle } from '$lib/nav/settings.svelte.js';

	const { trigger, destroy } = createWebHaptics();
	onDestroy(destroy);

	let mounted = $state(false);
	let menuOpen = $state(false);

	// The surface is a scroll-driven animation, not a scroll listener: a
	// `scroll(root block)` timeline on the shell carries `--nav-surface-scroll`
	// from 0 to 1. `scrolled` is only the fallback for a browser without scroll
	// timelines, and the check is what avoids installing the listener at all.
	let scrolled = $state(false);
	let scrollLinked = $state(false);

	// How far past the row the header reaches while open — what the surface and
	// hairline grow by. The band's height is measured, not asserted; a negative
	// lead is the band riding up into the row, so it comes off the total.
	let moreRowHeight = $state(0);
	let openExtra = $derived(menuOpen ? moreRowHeight + Math.min(0, navSettings.lead) : 0);

	// `--nav-h` is a page-wide token: it is what `scroll-padding-top` is built
	// from, so a `#hash` link does not land its heading behind the bar. app.css
	// must carry the shipped number statically — the browser scrolls to a deep
	// link while the document is still parsing. This only re-publishes a measured
	// height once there is one.
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
	let showName = $derived(!isHome || !heroName.visible);

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

<!-- The 4px that hands Safari the colour, and the one element on this page that
     is there for the browser's chrome rather than for the page.

     Safari 26 fills its status bar with the `background-color` of a fixed or
     sticky element at the top of the viewport. Measured on an iPhone: an opaque
     one paints the bar that colour flat and edge to edge, and with no candidate
     the bar is the page behind it, blurred — which on a dark article is the slab
     this is all about. `.nav-shell` cannot be the candidate: a colour on it
     paints the whole row, and the row is a ramp now.

     So this is the top stop of that ramp, on its own, 4px of it — over the
     threshold the scan wants, and invisible by construction, because the pixels
     directly under it are the same colour. At the top of the page it is the page
     colour on the page colour; scrolled, it is the scrim's own first stop. -->
<div aria-hidden="true" class="nav-edge"></div>

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
		<!-- The material is a ramp rather than a pane: it is the page's own colour at
		     the top edge and nothing at all at the bottom, with the blur deepening
		     the same way. The header stops having a bottom — no hairline, no step —
		     and the top is a colour rather than a translucency, which is what lets
		     the status bar above it be the same colour and the two read as one
		     surface running off the top of the screen. -->
		<div aria-hidden="true" class="nav-surface absolute inset-0 -z-10">
			<!-- Four passes, each masked to a band that starts higher than the last.
			     A `backdrop-filter` takes everything painted beneath it, siblings
			     included, so the passes compound: one radius at the bottom of the
			     ramp and four of them at the top, from a step small enough that no
			     single layer is expensive. The bands overlap by their own width, and
			     that overlap is the whole reason it reads as a gradient rather than
			     as four bars of increasing blur. -->
			<div class="nav-blur" data-step="1"></div>
			<div class="nav-blur" data-step="2"></div>
			<div class="nav-blur" data-step="3"></div>
			<div class="nav-blur" data-step="4"></div>
			<!-- Over the blur, not under it: this is the colour the type sits on, and
			     a scrim that had been through the passes above would be a blurred
			     gradient, which is a gradient with its ends pulled in. The stops are
			     eased — a straight alpha ramp ends visibly, in a soft edge across the
			     page about two thirds of the way down. -->
			<!-- Under the scrim, not over it, and that ordering is the whole of how the
			     open disclosure stays legible without flattening the ramp. A gradient
			     composited over a flat tint is the ramp lerped into it — floor at the
			     far end, still 1 at the top, the same shape in between — so the links
			     get their backing and the fade still runs the full height of the
			     grown header instead of collapsing into its top quarter. -->
			<div class="nav-panel"></div>
			<div class="nav-scrim"></div>
		</div>
		<!-- Centred, so the name and the links hang from one middle axis rather than
		     standing on one baseline — small links sharing a baseline with type this
		     much larger read as sitting on the floor beside it.

		     Centring is exactly the middle axis here, not an approximation of it:
		     Interlude's cap height equals its ascent minus its descent, which puts a
		     line box's centre on its own cap band's centre at any size. So the
		     wordmark's caps and the links' caps land on one axis, 3px off a shared
		     baseline, which is the trade being made deliberately. -->
		<!-- Eagerly prefetch the code chunks for the primary destinations (home and
		     every nav item) right after load, so a click never waits on the route JS.
		     Data preload stays `hover` (the body default) — /now and /health data hit
		     the server/Convex and shouldn't fetch for every link on every page. -->
		<nav
			bind:clientHeight={rowHeight}
			data-sveltekit-preload-code="eager"
			class="nav-row mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-12"
		>
			<a
				href="/"
				onclick={() => trigger([{ duration: 35 }], { intensity: 1 })}
				aria-label="Home — Injoon Oh"
				class="group inline-flex min-w-0 items-center {showName ? '' : 'pointer-events-none'}"
			>
				<!-- Two elements, because the name travels and the hole it travels
				     through does not: `.nav-name` is the window, one line box tall and
				     staying where it is, and `.nav-name-roll` is the line of type
				     rising into it.

				     The presence is carried by the roll, not by the type inside it.
				     That is what leaves the hover cross-fade underneath untouched: the
				     two spans go on trading places on their own `opacity`, and whatever
				     the roll is at multiplies through both. A scroll-driven animation
				     on the English span's own `opacity` would have taken the property
				     away from `group-hover:opacity-0` outright, and hovering the
				     wordmark would have stopped doing anything on the one page this
				     animation runs on. -->
				<span
					class="nav-name block min-w-0"
					data-shown={!isHome || showName}
					data-animate={mounted}
				>
					<span class="nav-name-roll relative block min-w-0">
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
	   Tailwind class carries, so a build with the panel folded away renders
	   exactly what the classes say. Overrides with `sm` variants are held below
	   that breakpoint: the dial is for the phone header. */
	/* The status bar's band is reserved inside the row, not above it. The page is
	   laid out `viewport-fit=cover`, so the sticky shell's `top: 0` is the
	   display's own top edge and the clock sits over whatever is in the first
	   59px of the header — the wordmark, on every page. Padding the row down out
	   of that band leaves the surface, which is `inset-0` of the wrapper around
	   this row, spanning it: the material goes edge to edge and the type does not.

	   The alternative — padding the shell — would have put the band *outside* the
	   surface's box and painted the header's blur short of the top of the screen,
	   which is the thing being fixed. */
	.nav-row {
		align-items: var(--nav-align, center);
		padding-block: calc(var(--nav-row-pad-y, 0.75rem) + var(--nav-safe-top, 0px))
			var(--nav-row-pad-y, 0.75rem);
	}

	.nav-cluster {
		translate: 0 var(--nav-cluster-nudge, 0px);
	}

	/* The lead changes form at zero: padding cannot go negative, and flush is not
	   the tightest these two lines can be set. Opening it pads the row inside the
	   band; closing it past flush moves the whole band, and the second line rides
	   up into slack that is empty anyway. */
	.nav-more {
		margin-top: min(0px, var(--nav-more-lead, -10px));
	}

	/* Two inputs with an opinion about the surface — scroll position and whether
	   the disclosure is open — composed with `max()` rather than taking turns.

	   They are registered `@property` numbers rather than an animated `opacity`
	   because an animation outranks every declaration for the property it runs on,
	   so a scroll-driven `opacity` would leave the open menu nothing to say. Each
	   input keeps its own timing: one on the scrollbar, one on a 200ms transition. */
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

	/* The header is above everything except an open lightbox — that one covers it,
	   which is the whole point of the scrim. The exception is the photo flying
	   back into the article: the box it lands in is often under this bar, and the
	   dialog paints at `z-index: 9999`, so the photo would cross over the bar and
	   then be sliced by it in the single frame the page takes it back.

	   The lightbox sets this the moment the photo reaches the bar's lower edge —
	   a moment when the two do not overlap at all, so nothing about the header
	   moves or fades. It is a paint order and nothing else. */
	:global(html[data-lightbox='returning']) .nav-shell {
		z-index: 10000;
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

	/* On the home page the wordmark is the second half of a handover: the hero
	   owns the name until it goes behind the header. It runs on the hero's own
	   view progress (`--nav-hero-name`, hoisted by `timeline-scope` on `:root`),
	   so it tracks the page rather than a clock — stop halfway and it stops
	   halfway.

	   It lands *on* the hero name, not merely in step with it. `--nav-name-travel`
	   is the gap between them and is derived, not chosen: the inset starts the
	   range with the hero name `--nav-h` down, the wordmark rests
	   `--nav-safe-top + (--nav-h - --nav-safe-top - 2rem) / 2` from the top of the
	   viewport, and the difference folds to `(--nav-h - --nav-safe-top + 2rem) / 2`
	   — 44px on a desktop, and still 44px on a phone, because the status bar's
	   band lengthens the header and the wordmark's rest position by exactly the
	   same amount. That value is also the range's end in px of scroll, which is
	   what makes the rate exactly 1:1. Anything else leaves the two names a
	   constant gap apart, which is a double image — and taking the reserve out is
	   not optional here: left in, the two would be 30px apart for the whole
	   handover on every iPhone. There is deliberately no dial for it.

	   `.nav-name` is the hole it rolls through, and has to be a second element:
	   the clip must hold still while the type inside it moves.

	   The hole has a soft lower lip, `--nav-name-portal` deep, so the type
	   dissolves through a threshold instead of being sliced by a clip edge. The
	   lip is room opened *below* the line box — `padding-bottom` adds it and an
	   equal negative `margin-bottom` takes it back out of layout, so `--nav-h`
	   does not move. The gradient's solid end is pinned to `2rem`, the type's own
	   line, which is what makes a deeper lip a longer dissolve rather than a bite
	   out of the wordmark.

	   `opacity` and `translate` are both composited and nothing else on this
	   element asks for either, so the handover stays off the main thread. The
	   registered-property-and-`max()` shape the surface uses would not. */
	.nav-name {
		overflow: hidden;
		padding-bottom: var(--nav-name-portal, 20px);
		margin-bottom: calc(-1 * var(--nav-name-portal, 20px));
		mask-image: linear-gradient(to bottom, #000 2rem, transparent 100%);
	}

	.nav-name-roll {
		--nav-name-travel: calc((var(--nav-h, 3.5rem) - var(--nav-safe-top, 0px) + 2rem) / 2);

		opacity: 1;
		translate: 0 0;
	}

	/* Where there is no view timeline to read, the observer's binary is still
	   what it was: a 200ms fade once the hero has gone, and the 4px nudge it has
	   always come in on rather than the full line — a roll that reads as movement
	   against the page reads as a swoosh against a clock. Held off until mount so
	   the home page does not animate its own first paint. */
	.nav-name[data-shown='false'] .nav-name-roll {
		opacity: 0;
		translate: 0 0.25rem;
	}

	.nav-name[data-animate='true'] .nav-name-roll {
		transition:
			opacity 200ms ease-out,
			translate 200ms ease-out;
	}

	/* Two animations on one timeline, because their ranges differ. The fade runs
	   `exit` — coupled to the hero name, so arrival tracks disappearance 1:1. The
	   rise runs the full `--nav-name-travel`, landing in the row 12px after the
	   hero is gone. One animation would mean writing the fade's end as 72.7%, with
	   both variables baked into a number. */
	@keyframes nav-name-fade {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes nav-name-rise {
		from {
			translate: 0 var(--nav-name-travel);
		}
		to {
			translate: 0 0;
		}
	}

	@supports (animation-timeline: view()) {
		/* Gated on the home page rather than left to an unresolved timeline name:
		   `timeline-scope` keeps the name in existence everywhere it is scoped,
		   inactive rather than absent, and an inactive timeline is not something
		   to have the wordmark's visibility on every other page depend on. */
		.nav-shell[data-home='true'] .nav-name-roll {
			animation:
				nav-name-fade linear both,
				nav-name-rise linear both;
			animation-timeline: --nav-hero-name, --nav-hero-name;
			animation-range:
				exit,
				exit 0px exit var(--nav-name-travel);
		}

		@media (prefers-reduced-motion: reduce) {
			.nav-shell[data-home='true'] .nav-name-roll {
				animation-duration: auto !important;
			}
		}
	}

	/* Sized by the row and stretched by however far the disclosure reaches, so one
	   ramp covers the header at every point in the animation — and stretching it
	   is what keeps the fade the height of whatever the header currently is,
	   rather than a gradient that ends partway down an open menu. Its presence is
	   not transitioned here — the two properties above carry it, and a transition
	   on top of a scroll-driven value would only make it lag. */
	.nav-surface {
		opacity: max(var(--nav-surface-scroll), var(--nav-surface-menu));
		bottom: calc(-1 * var(--nav-open-extra, 0px));
		transition: bottom var(--nav-duration, 320ms) var(--nav-ease);
	}

	/* The page's own background, as the three numbers a gradient stop can be
	   written from. `.nav-edge` is not inside the surface — it is fixed to the
	   viewport — so both are named here rather than the value living on one of
	   them. */
	.nav-surface,
	.nav-edge {
		--nav-surface-rgb: 255 255 255;
	}

	:global(html.dark) .nav-surface,
	:global(html.dark) .nav-edge {
		--nav-surface-rgb: 10 10 10;
	}

	.nav-surface > * {
		position: absolute;
		inset: 0;
	}

	/* One radius per pass, compounding upward. 3px is chosen against the four of
	   them: the top of the ramp lands near the 8px this header has always used,
	   and no single layer is doing the expensive thing on its own. */
	.nav-blur {
		-webkit-backdrop-filter: blur(var(--nav-blur-step, 3px));
		backdrop-filter: blur(var(--nav-blur-step, 3px));
	}

	/* Evenly stepped, and each band starts exactly at the midpoint of the one
	   below it: 18% apart, 36% wide, so the count of passes over any given point
	   climbs 1, 2, 3, 4 in equal measure from the bottom edge to the top. Even
	   spacing is the whole difference between a ramp and four bars of increasing
	   blur — bands that abut show their seams, and bands that overlap unevenly
	   read as a ramp with a lump in it.

	   Written to the top, because that is the end the ramp is anchored to: an open
	   disclosure lengthens the box downward and the deep end stays where it is.
	   They stop at 90% rather than 100% because the scrim is near-solid above
	   that, and a blur under an opaque colour is work nobody sees. */
	.nav-blur[data-step='1'] {
		-webkit-mask-image: linear-gradient(to top, transparent 0%, #000 36%);
		mask-image: linear-gradient(to top, transparent 0%, #000 36%);
	}

	.nav-blur[data-step='2'] {
		-webkit-mask-image: linear-gradient(to top, transparent 18%, #000 54%);
		mask-image: linear-gradient(to top, transparent 18%, #000 54%);
	}

	.nav-blur[data-step='3'] {
		-webkit-mask-image: linear-gradient(to top, transparent 36%, #000 72%);
		mask-image: linear-gradient(to top, transparent 36%, #000 72%);
	}

	.nav-blur[data-step='4'] {
		-webkit-mask-image: linear-gradient(to top, transparent 54%, #000 90%);
		mask-image: linear-gradient(to top, transparent 54%, #000 90%);
	}

	/* A smoothstep, sampled at eight even intervals, and the reason to spend eight
	   stops on it is that it is symmetric: every pair either side of the middle
	   sums to 1, and the curve leaves both ends flat. That flatness is what a
	   straight alpha ramp cannot give — it starts giving way at the very top edge,
	   where the article then shows through the pixels that are supposed to match
	   the status bar, and on a light page that reads as dirt under the wordmark.
	   It ends the same way, so there is no line where the header stops.

	   Every stop is a percentage of a box that is the row plus however far the
	   disclosure currently reaches, so opening it lengthens the ramp rather than
	   sliding it down: the ends stay pinned and the curve is spread over the
	   taller header. That is why the stops are percentages and the growth is on
	   the parent. */
	.nav-scrim {
		background-image: linear-gradient(
			to bottom,
			rgb(var(--nav-surface-rgb) / 1) 0%,
			rgb(var(--nav-surface-rgb) / 0.959) 12.5%,
			rgb(var(--nav-surface-rgb) / 0.844) 25%,
			rgb(var(--nav-surface-rgb) / 0.684) 37.5%,
			rgb(var(--nav-surface-rgb) / 0.5) 50%,
			rgb(var(--nav-surface-rgb) / 0.316) 62.5%,
			rgb(var(--nav-surface-rgb) / 0.156) 75%,
			rgb(var(--nav-surface-rgb) / 0.041) 87.5%,
			rgb(var(--nav-surface-rgb) / 0) 100%
		);
	}

	/* The floor the ramp is lerped into while the disclosure is down. Its own
	   opacity carries it, on the menu's half of the pair the surface fades on, so
	   it eases in over the same 200ms as everything else the menu moves — and the
	   closed header composites against nothing at all and is the ramp it has
	   always been. */
	.nav-panel {
		background-color: rgb(var(--nav-surface-rgb));
		opacity: calc(0.8 * var(--nav-surface-menu));
	}

	/* Fixed rather than sticky: it answers to the viewport, which is what the scan
	   measures against, and it must not move with a header that is only sticky
	   until the page is long enough. Never faded and never animated — the value
	   Safari reads is the one that is there at first paint. */
	.nav-edge {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: 4px;
		background-color: rgb(var(--nav-surface-rgb));
		pointer-events: none;
		z-index: 31;
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
