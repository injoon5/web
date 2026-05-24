<script>
	import { tick, onMount } from 'svelte';

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

	let tabsEl = $state(null);
	let tabsScrollEl = $state(null);
	let clipLeft = $state(0);
	let clipRight = $state(0);
	let clipVisible = $state(false);
	let clipReady = $state(false);

	const panelId = $derived(String(activeIndex));

	const items = $derived(
		activeIndex === 'favorites' ? favorites : (techstack[activeIndex]?.technologies ?? [])
	);

	function selectTab(index) {
		animated = true;
		activeIndex = index;
	}

	async function updateClip() {
		await tick();
		if (!tabsEl) return;

		const activeEl =
			activeIndex === 'favorites'
				? tabsEl.querySelector('[data-tab-fav]')
				: tabsEl.querySelector(`[data-tab-index="${activeIndex}"]`);
		if (!activeEl) return;

		const parentRect = tabsEl.getBoundingClientRect();
		const rect = activeEl.getBoundingClientRect();
		const left = rect.left - parentRect.left;
		const right = parentRect.width - (left + rect.width);
		clipLeft = left;
		clipRight = right;
		clipVisible = true;
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

		const onScroll = () => updateClip();
		tabsScrollEl?.addEventListener('scroll', onScroll, { passive: true });

		return () => {
			tabsScrollEl?.removeEventListener('scroll', onScroll);
		};
	});

	$effect(() => {
		if (!tabsEl || typeof ResizeObserver === 'undefined') return;

		const ro = new ResizeObserver(() => {
			updateClip();
		});
		ro.observe(tabsEl);
		return () => ro.disconnect();
	});

	function onTabKeydown(e, tabIndex, isFav) {
		// Arrow navigation: favorites is index -1 logically
		const total = techstack.length;
		if (e.key === 'ArrowRight') {
			e.preventDefault();
			activeIndex = isFav ? 0 : Math.min(tabIndex + 1, total - 1);
		} else if (e.key === 'ArrowLeft') {
			e.preventDefault();
			activeIndex = isFav ? 'favorites' : tabIndex === 0 ? 'favorites' : tabIndex - 1;
		} else if (e.key === 'Home') {
			e.preventDefault();
			activeIndex = 'favorites';
		} else if (e.key === 'End') {
			e.preventDefault();
			activeIndex = total - 1;
		} else return;
		// Focus the newly active tab
		const list = e.currentTarget.closest('[role="tablist"]');
		const sel =
			activeIndex === 'favorites'
				? list?.querySelector('[data-tab-fav]')
				: list?.querySelector(`[data-tab-index="${activeIndex}"]`);
		sel?.focus();
	}

	function panelOut(node, { skip = false } = {}) {
		if (skip) return { duration: 0 };
		const { offsetTop, offsetLeft, offsetWidth } = node;
		node.style.position = 'absolute';
		node.style.top = offsetTop + 'px';
		node.style.left = offsetLeft + 'px';
		node.style.width = offsetWidth + 'px';
		node.style.pointerEvents = 'none';
		return { duration: 160, css: (t) => `opacity: ${t}` };
	}

	function panelIn(node, { skip = false } = {}) {
		if (skip) return { duration: 0 };
		return { duration: 200, css: (t, u) => `opacity: ${t}; transform: translateY(${u * 5}px)` };
	}

	// Animates the wrapper height to match its inner content whenever it resizes.
	// First measurement skips the transition so there's no flash on mount.
	function animateHeight(node) {
		const inner = node.firstElementChild;
		if (!inner || typeof ResizeObserver === 'undefined') return {};

		let ready = false;

		const ro = new ResizeObserver(() => {
			const h = inner.offsetHeight;
			if (!ready) {
				node.style.transition = 'none';
				node.style.height = h + 'px';
				// Force a reflow so the transition:none takes effect before we re-enable
				node.getBoundingClientRect();
				node.style.transition = '';
				ready = true;
			} else {
				node.style.height = h + 'px';
			}
		});

		ro.observe(inner);
		return {
			destroy() {
				ro.disconnect();
			}
		};
	}
</script>

<div class="ts-root">
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
				style="font-size: 1rem;"
				onclick={() => selectTab('favorites')}
				onkeydown={(e) => onTabKeydown(e, -1, true)}
			>
				Favorites
			</button>
			{#each techstack as category, index}
				<button
					type="button"
					role="tab"
					data-tab-index={index}
					id="ts-tab-{index}"
					aria-selected={activeIndex === index}
					aria-controls="ts-panel"
					tabindex={activeIndex === index ? 0 : -1}
					class="ts-tab"
					style="font-size: 1rem;"
					onclick={() => selectTab(index)}
					onkeydown={(e) => onTabKeydown(e, index, false)}
				>
					{category.name}
				</button>
			{/each}
			<div
				class="ts-tabs-clip"
				class:ts-clip-animate={clipReady}
				style:clip-path="inset(0 {clipRight}px 0 {clipLeft}px)"
				style:opacity={clipVisible ? 1 : 0}
				aria-hidden="true"
			>
				<span class="ts-clip-item" style="font-size: 1rem;">Favorites</span>
				{#each techstack as category}
					<span class="ts-clip-item" style="font-size: 1rem;">{category.name}</span>
				{/each}
			</div>
		</div>
	</div>

	<div use:animateHeight class="ts-height-outer">
		<div class="ts-height-inner">
			{#key panelId}
				<div
					in:panelIn={{ skip: !animated }}
					out:panelOut={{ skip: !animated }}
					id="ts-panel"
					role="tabpanel"
					aria-label={activeIndex === 'favorites' ? 'Favorites' : techstack[activeIndex]?.name}
					class="ts-panel"
					class:ts-panel-animate={animated}
				>
					{#each items as tech, i}
						<div class="ts-item" style="--i: {i}">
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
	/* --- Tabs --- */
	.ts-tabs-scroll {
		overflow-x: auto;
		overscroll-behavior-x: contain;
		scrollbar-width: none;
		margin-bottom: 0.75rem;
	}

	.ts-tabs-scroll::-webkit-scrollbar {
		display: none;
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
		padding: 0.25rem 0.6rem 0.25rem 0;
		font-size: 0.875rem;
		font-weight: 500;
		white-space: nowrap;
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
		outline: 2px solid var(--color-neutral-400);
		outline-offset: 2px;
		border-radius: 2px;
	}

	/* Dot separator */
	.ts-tab + .ts-tab::before,
	.ts-clip-item + .ts-clip-item::before {
		content: '·';
		padding-right: 0.6rem;
		color: var(--color-neutral-300);
		pointer-events: none;
		font-weight: 400;
	}

	:global(.dark) .ts-tab + .ts-tab::before,
	:global(.dark) .ts-clip-item + .ts-clip-item::before {
		color: var(--color-neutral-700);
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
		transition:
			clip-path var(--motion-base) var(--ease-out-soft),
			opacity var(--motion-fast) ease;
	}

	/* --- Animated height wrapper --- */
	.ts-height-outer {
		overflow: hidden;
		transition: height 260ms var(--ease-out-soft);
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

	.ts-panel-animate {
		animation: ts-panel-in var(--motion-slow) var(--ease-out-soft) both;
	}

	@media (min-width: 640px) {
		.ts-panel {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@keyframes ts-panel-in {
		from {
			opacity: 0;
			transform: translateY(5px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* --- Items --- */
	.ts-item {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.ts-panel-animate .ts-item {
		animation: ts-item-in 300ms var(--ease-out-soft) both;
		animation-delay: calc(var(--i) * 45ms);
	}

	@keyframes ts-item-in {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
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
		.ts-tabs-clip.ts-clip-animate {
			transition: none;
		}
		.ts-panel-animate,
		.ts-panel-animate .ts-item {
			animation: none;
		}
	}
</style>
