<script>
	import { page } from '$app/state';
	import { createWebHaptics } from 'web-haptics/svelte';
	import { onMount, onDestroy } from 'svelte';
	import { heroNameVisible } from '$lib/heroNav.js';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';

	const { trigger, destroy } = createWebHaptics();
	onDestroy(destroy);

	let mounted = $state(false);
	let menuOpen = $state(false);
	let scrolled = $state(false);
	// The surface is painted once the page moves under it — and also whenever the
	// disclosure is open, since it drops over page content from scroll offset 0.
	let surfaced = $derived(scrolled || menuOpen);

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
<div bind:this={root} id="site-nav" class="sticky top-0 z-30">
	<div class="relative">
		<div
			aria-hidden="true"
			class="absolute inset-0 -z-10 backdrop-blur-md transition-colors duration-200
			{surfaced ? 'bg-white/70 dark:bg-neutral-950/70' : 'bg-white/0 dark:bg-neutral-950/0'}"
		></div>
		<!-- While the menu is open the hairline belongs at the bottom of the panel,
		     not across the middle of one continuous surface. -->
		<div
			aria-hidden="true"
			class="absolute inset-x-0 bottom-0 h-px bg-neutral-200/70 transition-opacity duration-200 dark:bg-neutral-800/70
			{surfaced && !menuOpen ? 'opacity-100' : 'opacity-0'}"
		></div>
		<!-- `items-baseline`, not `items-center`: centring puts the 32px wordmark
		     line box and the 24px link line box on a common centre, which lands
		     their baselines 3px apart. The links sat that much high against the
		     name for as long as this header has existed. -->
		<nav class="mx-auto flex max-w-6xl items-baseline justify-between gap-3 px-4 py-3 sm:px-12">
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
			<div class="flex shrink-0 items-center gap-0 sm:gap-4">
				<ul class="flex items-center gap-3 sm:gap-4">
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
					class="-my-2 -mr-[15px] inline-flex h-10 w-10 items-center justify-center transition-colors duration-150 sm:hidden {menuOpen ||
					moreActive
						? 'text-neutral-900 dark:text-neutral-100'
						: 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-100'}"
				>
					<ChevronDown
						size={18}
						strokeWidth={2.25}
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
		class="absolute inset-x-0 top-full grid sm:hidden {mounted ? 'nav-more-animate' : ''} {menuOpen
			? 'grid-rows-[1fr]'
			: 'grid-rows-[0fr]'}"
	>
		<div class="relative min-h-0 overflow-hidden">
			<div
				aria-hidden="true"
				class="absolute inset-0 -z-10 backdrop-blur-md transition-colors duration-200
				{menuOpen ? 'bg-white/70 dark:bg-neutral-950/70' : 'bg-white/0 dark:bg-neutral-950/0'}"
			></div>
			<div
				aria-hidden="true"
				class="absolute inset-x-0 bottom-0 h-px bg-neutral-200/70 transition-opacity duration-200 dark:bg-neutral-800/70
				{menuOpen ? 'opacity-100' : 'opacity-0'}"
			></div>
			<!-- Spacing set off the baselines, not the boxes. The row's baseline is at
			     37px; 11px of lead puts this one at 85px, so the open header is the
			     closed one with a second line set at exactly 48px — twice the 24px
			     line height. 13px below leaves the same 19px from baseline to the
			     header's bottom edge that the closed header already has, so opening
			     the menu moves the hairline without changing its relationship to the
			     type. Same 12px word gap as the row above.

			     41px on the right is the 16px page gutter plus the 25px of the
			     chevron's tap target that sits inside the row — its 40px box less the
			     15px it hangs past the margin. That is what ends this row on 'blog',
			     rather than out under the chevron on the page margin. -->
			<ul
				class="mx-auto flex max-w-6xl items-center justify-end gap-3 pt-[11px] pr-[41px] pb-[13px] pl-4"
			>
				{#each moreItems as item, i (item.href)}
					<li>
						<a
							href={item.href}
							onclick={() => trigger([{ duration: 25 }], { intensity: 0.7 })}
							style="transition-delay: {menuOpen ? 40 + i * 55 : 0}ms"
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

<style>
	/* The site's own ease-out tokens are steep enough that 90% of a 320ms move is
	   over in ~110ms — right for a colour or a 4px nudge, but it makes a header
	   that grows by 50px read as a jump cut. This curve carries more of its
	   distance through the middle of the duration, so the growth is legible
	   without feeling slow. */
	.nav-more-animate,
	.nav-more-link,
	:global(.nav-chevron) {
		--nav-ease: cubic-bezier(0.32, 0.72, 0, 1);
	}

	/* Held off until mount so a page that loads with the menu shut doesn't
	   animate open from 0fr on hydration. */
	.nav-more-animate {
		transition: grid-template-rows 320ms var(--nav-ease);
	}

	/* `translate` and `rotate`, never `transform`: Tailwind v4 compiles its
	   translate and rotate utilities to those standalone properties, so a
	   transition naming `transform` animates nothing at all — the element just
	   snaps to its new position while whatever else is in the list eases. */
	.nav-more-link {
		transition:
			opacity 260ms var(--nav-ease),
			translate 260ms var(--nav-ease),
			color 150ms ease;
	}

	:global(.nav-chevron) {
		transition: rotate 320ms var(--nav-ease);
	}

	/* The global reduce rule collapses durations but not delays, which would
	   otherwise hold the second link blank for ~95ms after the row has grown. */
	@media (prefers-reduced-motion: reduce) {
		.nav-more-link {
			transition-delay: 0ms !important;
		}
	}
</style>
