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
	let scrolled = $state(false);
	// The surface is painted once the page moves under it — and also whenever the
	// disclosure is open, since it drops over page content from scroll offset 0.
	let surfaced = $derived(scrolled || menuOpen);

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
		onWindowScroll();
		window.addEventListener('scroll', onWindowScroll, { passive: true });

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
     the header stops sticking — nothing paints its surface without the scroll
     listener either, and a transparent bar over scrolling text is worse than a
     bar that scrolls away. `inert` is only ever applied after mount, and these
     rules outrank the collapsed utilities on specificity alone. -->
<svelte:head>
	<noscript>
		<style>
			#site-nav {
				position: static;
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
	style="--nav-open-extra:{openExtra}px{__DIALS__ ? ';' + navStyle() : ''}"
>
	<div class="relative">
		<!-- One surface for the whole header, grown from the bottom, rather than one
		     per row. Two adjacent backdrop-filter layers each clamp their blur at
		     the shared edge, so neither pulls in what is behind the other and the
		     seam paints as a visible step in the tint — measured at five levels over
		     a dark page, which is exactly the width of the disclosure. -->
		<div
			aria-hidden="true"
			class="nav-surface absolute inset-0 -z-10 backdrop-blur-md
			{surfaced ? 'bg-white/70 dark:bg-neutral-950/70' : 'bg-white/0 dark:bg-neutral-950/0'}"
		></div>
		<!-- And one hairline, which slides down to the new bottom edge as the
		     disclosure opens instead of a second one fading in beneath it. -->
		<div
			aria-hidden="true"
			class="nav-hairline absolute inset-x-0 bottom-0 h-px bg-neutral-200/70 dark:bg-neutral-800/70
			{surfaced ? 'opacity-100' : 'opacity-0'}"
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
				<span class="relative block min-w-0">
					<span
						class="block truncate font-sans text-2xl font-medium tracking-tight will-change-auto group-hover:opacity-0 group-hover:blur-sm
					{mounted ? 'transition-[opacity,filter,translate] duration-200 ease-out' : ''}
					{showName ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'}"
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

	/* The surface and the hairline are sized by the row and then stretched past it
	   by however far the disclosure currently reaches, so one blurred pane covers
	   the whole header at every point in the animation. They ease on the same
	   curve and duration as the row that is pushing them. */
	.nav-surface,
	.nav-hairline {
		bottom: calc(-1 * var(--nav-open-extra, 0px));
		transition:
			bottom var(--nav-duration, 320ms) var(--nav-ease),
			background-color 200ms ease,
			opacity 200ms ease;
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
