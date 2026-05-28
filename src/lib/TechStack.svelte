<script>
	import { tick, onMount } from 'svelte';
	import { cubicOut } from 'svelte/easing';

	let { techstack = [] } = $props();

	const FAVORITES = ['SvelteKit', 'SwiftUI', 'Convex', 'Figma', 'Obsidian', 'MacBook Pro'];

	const favorites = $derived(
		FAVORITES.map((name) =>
			techstack.flatMap((cat) => cat.technologies).find((t) => t.name === name)
		).filter(Boolean)
	);

	// 'favorites' | number (category index)
	let activeIndex = $state('favorites');
	let animated = $state(false);
	let keyboardNav = $state(false);

	let tabsEl = $state(null);
	let tabsScrollEl = $state(null);
	let heightOuterEl = $state(null);
	let clipLeft = $state(0);
	let clipRight = $state(0);
	let clipVisible = $state(false);
	let clipReady = $state(false);
	let fadeLeft = $state(false);
	let fadeRight = $state(false);

	const SCROLL_FADE_EPS = 2;

	const panelId = $derived(String(activeIndex));

	const items = $derived(
		activeIndex === 'favorites' ? favorites : (techstack[activeIndex]?.technologies ?? [])
	);

	const PANEL_MS = 280;
	const HEIGHT_MS = 280;
	const ITEM_STAGGER_MS = 40;
	const ITEM_MAX_STAGGER = 6;

	async function selectTab(index) {
		if (index === activeIndex) return;
		keyboardNav = false;

		const wasAnimated = animated;
		const startH = measurePanelHeight();

		animated = true;

		if (wasAnimated && startH > 0) {
			setOuterHeight(startH, { animate: false });
		}

		activeIndex = index;
		await tick();

		if (!wasAnimated) {
			const h = measurePanelHeight();
			if (h > 0) setOuterHeight(h, { animate: false });
			return;
		}

		requestAnimationFrame(() => {
			const endH = measurePanelHeight();
			const target = Math.max(startH, endH);
			if (target > 0) setOuterHeight(target);
		});
	}

	function updateScrollFade() {
		const el = tabsScrollEl;
		if (!el) return;

		const { scrollLeft, scrollWidth, clientWidth } = el;
		const overflow = scrollWidth - clientWidth > SCROLL_FADE_EPS;
		if (!overflow) {
			fadeLeft = false;
			fadeRight = false;
			return;
		}

		fadeLeft = scrollLeft > SCROLL_FADE_EPS;
		fadeRight = scrollLeft + clientWidth < scrollWidth - SCROLL_FADE_EPS;
	}

	async function updateClip() {
		await tick();
		if (!tabsEl) return;

		const activeEl =
			activeIndex === 'favorites'
				? tabsEl.querySelector('[data-tab-fav]')
				: tabsEl.querySelector(`[data-tab-index="${activeIndex}"]`);
		if (!activeEl) return;

		const labelEl = activeEl.querySelector('.ts-tab-label') ?? activeEl;
		const parentRect = tabsEl.getBoundingClientRect();
		const rect = labelEl.getBoundingClientRect();
		const left = rect.left - parentRect.left;
		const right = parentRect.width - (left + rect.width);
		clipLeft = left;
		clipRight = right;
		clipVisible = true;
	}

	function measurePanelHeight() {
		const inner = heightOuterEl?.firstElementChild;
		if (!inner) return 0;
		return inner.getBoundingClientRect().height;
	}

	function setOuterHeight(px, { animate = true } = {}) {
		const outer = heightOuterEl;
		if (!outer || px <= 0) return;

		if (!animate) {
			outer.style.transition = 'none';
			outer.style.height = `${px}px`;
			outer.getBoundingClientRect();
			outer.style.transition = '';
			return;
		}

		outer.style.height = `${px}px`;
	}

	async function onPanelOutroEnd() {
		await tick();
		requestAnimationFrame(() => {
			const h = measurePanelHeight();
			if (h > 0) setOuterHeight(h);
		});
	}

	$effect(() => {
		activeIndex;
		updateClip();
	});

	onMount(() => {
		updateClip().then(() => {
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					clipReady = true;
				});
			});
		});

		const h = measurePanelHeight();
		if (h > 0) setOuterHeight(h, { animate: false });

		const onScroll = () => {
			updateScrollFade();
			updateClip();
		};
		updateScrollFade();
		tabsScrollEl?.addEventListener('scroll', onScroll, { passive: true });

		const onResize = () => {
			updateScrollFade();
			updateClip();
			const next = measurePanelHeight();
			if (next > 0) setOuterHeight(next, { animate: false });
		};
		window.addEventListener('resize', onResize);

		return () => {
			tabsScrollEl?.removeEventListener('scroll', onScroll);
			window.removeEventListener('resize', onResize);
		};
	});

	$effect(() => {
		if (!tabsEl || typeof ResizeObserver === 'undefined') return;

		const ro = new ResizeObserver(() => {
			updateScrollFade();
			updateClip();
		});
		ro.observe(tabsEl);
		if (tabsScrollEl) ro.observe(tabsScrollEl);
		return () => ro.disconnect();
	});

	function onTabKeydown(e, tabIndex, isFav) {
		const total = techstack.length;
		let next = null;

		if (e.key === 'ArrowRight') {
			e.preventDefault();
			keyboardNav = true;
			next = isFav ? 0 : Math.min(tabIndex + 1, total - 1);
		} else if (e.key === 'ArrowLeft') {
			e.preventDefault();
			keyboardNav = true;
			next = isFav ? 'favorites' : tabIndex === 0 ? 'favorites' : tabIndex - 1;
		} else if (e.key === 'Home') {
			e.preventDefault();
			keyboardNav = true;
			next = 'favorites';
		} else if (e.key === 'End') {
			e.preventDefault();
			keyboardNav = true;
			next = total - 1;
		} else return;

		selectTab(next);

		const list = e.currentTarget.closest('[role="tablist"]');
		const sel =
			next === 'favorites'
				? list?.querySelector('[data-tab-fav]')
				: list?.querySelector(`[data-tab-index="${next}"]`);
		sel?.focus();
	}

	function panelOut(node, { skip = false } = {}) {
		if (skip) return { duration: 0 };

		const parent = node.parentElement;
		if (parent) parent.style.position = 'relative';

		node.style.position = 'absolute';
		node.style.inset = '0';
		node.style.width = '100%';
		node.style.pointerEvents = 'none';
		node.style.zIndex = '0';

		return {
			duration: PANEL_MS,
			easing: cubicOut,
			css: (t, u) => {
				const y = u * 6;
				const blur = u * 3;
				return `opacity: ${t}; transform: translateY(${y}px); filter: blur(${blur}px)`;
			}
		};
	}

	function panelIn(node, { skip = false } = {}) {
		if (skip) return { duration: 0 };

		node.style.position = 'relative';
		node.style.zIndex = '1';

		return {
			duration: PANEL_MS,
			easing: cubicOut,
			css: (t, u) => {
				const y = u * 6;
				const blur = u * 3;
				return `opacity: ${t}; transform: translateY(${y}px); filter: blur(${blur}px)`;
			}
		};
	}

	function itemIn(node, { index = 0, skip = false } = {}) {
		if (skip) return { duration: 0 };

		const delay = Math.min(index, ITEM_MAX_STAGGER) * ITEM_STAGGER_MS;

		return {
			delay,
			duration: 220,
			easing: cubicOut,
			css: (t, u) => {
				const y = u * 8;
				const blur = u * 2;
				return `opacity: ${t}; transform: translateY(${y}px); filter: blur(${blur}px)`;
			}
		};
	}
</script>

<div class="ts-root">
	<div class="ts-tabs-scroll-wrap">
		<div bind:this={tabsScrollEl} class="ts-tabs-scroll">
			<div bind:this={tabsEl} role="tablist" aria-label="Tech stack categories" class="ts-tabs">
				<button
					type="button"
					role="tab"
					data-tab-fav
					id="ts-tab-fav"
					aria-selected={activeIndex === 'favorites'}
					aria-controls="ts-panel"
					tabindex={activeIndex === 'favorites' ? 0 : -1}
					class="ts-tab"
					onclick={() => selectTab('favorites')}
					onkeydown={(e) => onTabKeydown(e, -1, true)}
				>
					<span class="ts-tab-label">Favorites</span>
				</button>
				{#each techstack as category, index}
					<span class="ts-sep" aria-hidden="true">·</span>
					<button
						type="button"
						role="tab"
						data-tab-index={index}
						id="ts-tab-{index}"
						aria-selected={activeIndex === index}
						aria-controls="ts-panel"
						tabindex={activeIndex === index ? 0 : -1}
						class="ts-tab"
						onclick={() => selectTab(index)}
						onkeydown={(e) => onTabKeydown(e, index, false)}
					>
						<span class="ts-tab-label">{category.name}</span>
					</button>
				{/each}
				<div
					class="ts-tabs-clip"
					class:ts-clip-animate={clipReady && !keyboardNav}
					style:clip-path="inset(0 {clipRight}px 0 {clipLeft}px)"
					style:opacity={clipVisible ? 1 : 0}
					aria-hidden="true"
				>
					<span class="ts-clip-item"><span class="ts-tab-label">Favorites</span></span>
					{#each techstack as category}
						<span class="ts-clip-gap" aria-hidden="true">·</span>
						<span class="ts-clip-item"><span class="ts-tab-label">{category.name}</span></span>
					{/each}
				</div>
			</div>
		</div>
		<div
			class="ts-tabs-fade ts-tabs-fade-left"
			class:ts-tabs-fade-visible={fadeLeft}
			aria-hidden="true"
		></div>
		<div
			class="ts-tabs-fade ts-tabs-fade-right"
			class:ts-tabs-fade-visible={fadeRight}
			aria-hidden="true"
		></div>
	</div>

	<div bind:this={heightOuterEl} class="ts-height-outer" style:--ts-height-ms="{HEIGHT_MS}ms">
		<div class="ts-height-inner">
			{#key panelId}
				<div
					in:panelIn={{ skip: !animated }}
					out:panelOut={{ skip: !animated }}
					onoutroend={onPanelOutroEnd}
					id="ts-panel"
					role="tabpanel"
					aria-label={activeIndex === 'favorites' ? 'Favorites' : techstack[activeIndex]?.name}
					class="ts-panel"
				>
					{#each items as tech, i (tech.name)}
						<div class="ts-item" in:itemIn={{ index: i, skip: !animated }}>
							<a href={tech.link} target="_blank" rel="noopener noreferrer" class="ts-name"
								>{tech.name}</a
							>
							<p class="ts-desc text-pretty">{tech.description}</p>
						</div>
					{/each}
				</div>
			{/key}
		</div>
	</div>
</div>

<style>
	/* Isolate tab metrics from homepage section typography (text-lg, etc.) */
	.ts-root {
		font-size: 1rem;
		line-height: 1.25rem;
		--ts-fade-bg: #fff;
	}

	:global(.dark) .ts-root {
		--ts-fade-bg: var(--color-neutral-950);
	}

	/* --- Tabs --- */
	.ts-tabs-scroll-wrap {
		position: relative;
		margin-bottom: 0.75rem;
	}

	.ts-tabs-scroll {
		overflow-x: auto;
		overscroll-behavior-x: contain;
		scrollbar-width: none;
	}

	.ts-tabs-fade {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 1.75rem;
		pointer-events: none;
		opacity: 0;
		transition: opacity 160ms ease;
		z-index: 1;
	}

	.ts-tabs-fade-left {
		left: 0;
		background: linear-gradient(to right, var(--ts-fade-bg) 15%, transparent);
	}

	.ts-tabs-fade-right {
		right: 0;
		background: linear-gradient(to left, var(--ts-fade-bg) 15%, transparent);
	}

	.ts-tabs-fade-visible {
		opacity: 1;
	}

	@media (min-width: 640px) {
		.ts-tabs-fade {
			display: none;
		}
	}

	.ts-tabs-scroll::-webkit-scrollbar {
		display: none;
	}

	.ts-tabs,
	.ts-tabs-clip {
		align-items: center;
	}

	.ts-tabs {
		position: relative;
		display: inline-flex;
		flex-wrap: nowrap;
		gap: 0;
	}

	.ts-tab,
	.ts-clip-item {
		flex-shrink: 0;
		margin: 0;
		padding: 0.25rem 0 0.25rem 0;
		border: 0;
		background: none;
		appearance: none;
		font: inherit;
		font-weight: 500;
		white-space: nowrap;
	}

	.ts-tab {
		cursor: pointer;
		color: inherit;
	}

	.ts-tab-label {
		display: inline-block;
	}

	.ts-sep,
	.ts-clip-gap {
		box-sizing: border-box;
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.45rem;
		padding: 0.25rem 0;
		font: inherit;
		font-weight: 400;
		line-height: 1.25rem;
		pointer-events: none;
		user-select: none;
	}

	.ts-sep {
		color: var(--color-neutral-300);
	}

	:global(.dark) .ts-sep {
		color: var(--color-neutral-700);
	}

	.ts-clip-gap {
		visibility: hidden;
	}

	.ts-tab {
		color: var(--color-neutral-400);
	}

	:global(.dark) .ts-tab {
		color: var(--color-neutral-500);
	}

	/* Active color comes only from the clip layer — keep base tabs muted while it slides. */
	.ts-tab[aria-selected='true'] {
		color: var(--color-neutral-400);
	}

	:global(.dark) .ts-tab[aria-selected='true'] {
		color: var(--color-neutral-500);
	}

	@media (hover: hover) and (pointer: fine) {
		.ts-tab:hover:not([aria-selected='true']) {
			color: var(--color-neutral-700);
			transition: color 120ms ease;
		}
		:global(.dark) .ts-tab:hover:not([aria-selected='true']) {
			color: var(--color-neutral-300);
		}
	}

	.ts-tab:focus-visible {
		outline: none;
	}

	.ts-tabs-clip {
		position: absolute;
		inset: 0;
		display: flex;
		flex-wrap: nowrap;
		pointer-events: none;
		color: var(--color-neutral-900);
		opacity: 0;
	}

	:global(.dark) .ts-tabs-clip {
		color: var(--color-neutral-100);
	}

	.ts-tabs-clip.ts-clip-animate {
		will-change: clip-path, opacity;
		transition:
			clip-path var(--motion-base) var(--ease-out-soft),
			opacity var(--motion-fast) ease;
	}

	/* --- Animated height wrapper --- */
	.ts-height-outer {
		overflow: hidden;
		transition: height var(--ts-height-ms, 280ms) var(--ease-out-soft);
	}

	.ts-height-inner {
		position: relative;
	}

	/* --- Panel --- */
	.ts-panel {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1rem;
	}

	@media (min-width: 640px) {
		.ts-panel {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	/* --- Items --- */
	.ts-item {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.ts-name {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-neutral-900);
		line-height: 1.3;
		text-decoration: none;
	}

	:global(.dark) .ts-name {
		color: var(--color-neutral-100);
	}

	@media (hover: hover) and (pointer: fine) {
		.ts-name:hover {
			text-decoration: underline;
		}
	}

	.ts-desc {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-neutral-600);
		line-height: 1.5;
	}

	:global(.dark) .ts-desc {
		color: var(--color-neutral-400);
	}

	@media (prefers-reduced-motion: reduce) {
		.ts-height-outer {
			transition: none;
		}
		.ts-tabs-clip.ts-clip-animate,
		.ts-tabs-fade {
			transition: none;
		}
	}
</style>
