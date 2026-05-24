<script>
	import { tick } from 'svelte';
	import Globe from '@lucide/svelte/icons/globe';
	import Smartphone from '@lucide/svelte/icons/smartphone';
	import Brackets from '@lucide/svelte/icons/brackets';
	import Wrench from '@lucide/svelte/icons/wrench';
	import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
	import { inViewOnce } from '$lib/actions/inViewOnce.js';

	let { techstack = [] } = $props();

	const categoryMeta = {
		'Web Development': { Icon: Globe, accent: 'var(--color-sky-500)' },
		'App Development': { Icon: Smartphone, accent: 'var(--color-violet-500)' },
		'Other Languages': { Icon: Brackets, accent: 'var(--color-amber-500)' },
		'Infrastructure & Tools': { Icon: Wrench, accent: 'var(--color-emerald-500)' }
	};

	let activeIndex = $state(0);
	let expandedId = $state(null);
	let tablistEl = $state(null);
	let indicator = $state({ left: 0, width: 0, ready: false });

	const activeCategory = $derived(techstack[activeIndex] ?? techstack[0]);
	const activeAccent = $derived(
		categoryMeta[activeCategory?.name]?.accent ?? 'var(--color-neutral-400)'
	);

	function techKey(categoryName, techName) {
		return `${categoryName}::${techName}`;
	}

	function selectCategory(index) {
		if (index === activeIndex) return;
		activeIndex = index;
		expandedId = null;
		queueIndicatorUpdate();
		scrollActiveTabIntoView();
	}

	function scrollActiveTabIntoView() {
		if (!tablistEl) return;
		const tab = tablistEl.querySelector(`[data-tab-index="${activeIndex}"]`);
		const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		tab?.scrollIntoView({
			behavior: smooth ? 'smooth' : 'instant',
			block: 'nearest',
			inline: 'center'
		});
	}

	function toggleExpanded(id) {
		expandedId = expandedId === id ? null : id;
	}

	async function queueIndicatorUpdate() {
		await tick();
		updateIndicator();
	}

	function updateIndicator() {
		if (!tablistEl) return;
		const tab = tablistEl.querySelector(`[data-tab-index="${activeIndex}"]`);
		if (!tab) return;
		const listRect = tablistEl.getBoundingClientRect();
		const tabRect = tab.getBoundingClientRect();
		indicator = {
			left: tabRect.left - listRect.left + tablistEl.scrollLeft,
			width: tabRect.width,
			ready: true
		};
	}

	function onTabKeydown(event, index) {
		let next = index;
		if (event.key === 'ArrowRight') next = (index + 1) % techstack.length;
		else if (event.key === 'ArrowLeft') next = (index - 1 + techstack.length) % techstack.length;
		else if (event.key === 'Home') next = 0;
		else if (event.key === 'End') next = techstack.length - 1;
		else return;

		event.preventDefault();
		selectCategory(next);
		tablistEl?.querySelector(`[data-tab-index="${next}"]`)?.focus();
	}

	$effect(() => {
		activeIndex;
		queueIndicatorUpdate();
	});

	$effect(() => {
		if (!tablistEl) return;
		const onScroll = () => updateIndicator();
		tablistEl.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', onScroll);
		queueIndicatorUpdate();
		return () => {
			tablistEl.removeEventListener('scroll', onScroll);
			window.removeEventListener('resize', onScroll);
		};
	});
</script>

<div
	use:inViewOnce
	class="tech-stack"
	style="--tech-accent: {activeAccent}"
>
	<div class="tech-stack-intro">
		<p class="tech-stack-kicker text-sm font-medium text-neutral-500 dark:text-neutral-500">
			What I reach for
		</p>
		<p class="tech-stack-hint text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
			Pick a lane to explore the tools behind this site, apps, and experiments.
		</p>
	</div>

	<div class="tech-stack-controls">
		<div
			bind:this={tablistEl}
			class="tech-tablist"
			role="tablist"
			aria-label="Tech stack categories"
		>
			<span
				class="tech-tab-indicator"
				class:tech-tab-indicator-ready={indicator.ready}
				style="transform: translateX({indicator.left}px); width: {indicator.width}px;"
				aria-hidden="true"
			></span>

			{#each techstack as category, index}
				{@const meta = categoryMeta[category.name]}
				<button
					type="button"
					role="tab"
					data-tab-index={index}
					id="tech-tab-{index}"
					aria-selected={activeIndex === index}
					aria-controls="tech-panel-{index}"
					tabindex={activeIndex === index ? 0 : -1}
					class="tech-tab"
					class:tech-tab-active={activeIndex === index}
					onclick={() => selectCategory(index)}
					onkeydown={(e) => onTabKeydown(e, index)}
				>
					{#if meta?.Icon}
						{@const TabIcon = meta.Icon}
						<TabIcon class="tech-tab-icon" aria-hidden="true" />
					{/if}
					<span class="tech-tab-label">{category.name}</span>
					<span class="tech-tab-count tabular">{category.technologies.length}</span>
				</button>
			{/each}
		</div>
	</div>

	{#key activeIndex}
		<div
			id="tech-panel-{activeIndex}"
			role="tabpanel"
			aria-labelledby="tech-tab-{activeIndex}"
			class="tech-panel"
		>
			<div class="tech-grid">
				{#each activeCategory.technologies as technology, techIndex}
					{@const id = techKey(activeCategory.name, technology.name)}
					{@const expanded = expandedId === id}
					<article
						class="tech-card"
						class:tech-card-expanded={expanded}
						style="--stagger-index: {techIndex}"
					>
						<div class="tech-card-accent" aria-hidden="true"></div>

						<div class="tech-card-top">
							<h3 class="tech-card-title">{technology.name}</h3>
							<a
								href={technology.link}
								target="_blank"
								rel="noopener noreferrer"
								class="tech-card-link"
								aria-label="Visit {technology.name} website"
							>
								<ArrowUpRight class="tech-card-link-icon" aria-hidden="true" />
							</a>
						</div>

						<p id="tech-desc-{id}" class="tech-card-description text-pretty">{technology.description}</p>

						<button
							type="button"
							class="tech-card-more"
							aria-expanded={expanded}
							aria-controls="tech-desc-{id}"
							onclick={() => toggleExpanded(id)}
						>
							{expanded ? 'Show less' : 'Read more'}
						</button>
					</article>
				{/each}
			</div>
		</div>
	{/key}
</div>

<style>
	.tech-stack {
		--tech-card-radius: 0.875rem;
		--tech-card-inner-radius: 0.5rem;
	}

	.tech-stack-intro {
		margin-bottom: 1.25rem;
		max-width: 36rem;
	}

	.tech-stack-kicker {
		margin-bottom: 0.35rem;
		text-wrap: balance;
	}

	.tech-stack-hint {
		text-wrap: pretty;
	}

	.tech-stack-controls {
		margin-bottom: 1rem;
	}

	.tech-tablist {
		position: relative;
		display: flex;
		gap: 0.35rem;
		overflow-x: auto;
		overscroll-behavior-x: contain;
		scrollbar-width: none;
		padding: 0.2rem;
		margin: 0 -0.2rem;
		scroll-snap-type: x proximity;
	}

	.tech-tablist::-webkit-scrollbar {
		display: none;
	}

	.tech-tab-indicator {
		position: absolute;
		top: 0.2rem;
		bottom: 0.2rem;
		left: 0;
		border-radius: 9999px;
		background: color-mix(in oklab, var(--tech-accent) 14%, transparent);
		box-shadow:
			inset 0 0 0 1px color-mix(in oklab, var(--tech-accent) 22%, transparent),
			0 1px 2px rgba(0, 0, 0, 0.04);
		opacity: 0;
		transition:
			transform var(--motion-base) var(--ease-out-soft),
			width var(--motion-base) var(--ease-out-soft),
			opacity var(--motion-fast) ease;
		pointer-events: none;
	}

	.tech-tab-indicator-ready {
		opacity: 1;
	}

	.tech-tab {
		position: relative;
		z-index: 1;
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		min-height: 2.5rem;
		padding: 0.55rem 0.85rem;
		border-radius: 9999px;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-neutral-600);
		white-space: nowrap;
		scroll-snap-align: start;
		transition: color var(--motion-fast) ease;
	}

	:global(.dark) .tech-tab {
		color: var(--color-neutral-400);
	}

	.tech-tab-active {
		color: var(--color-neutral-900);
	}

	:global(.dark) .tech-tab-active {
		color: var(--color-neutral-100);
	}

	.tech-tab:focus-visible {
		outline: 2px solid color-mix(in oklab, var(--tech-accent) 70%, transparent);
		outline-offset: 2px;
	}

	.tech-tab-icon {
		width: 0.95rem;
		height: 0.95rem;
		opacity: 0.72;
	}

	.tech-tab-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.25rem;
		height: 1.25rem;
		padding: 0 0.35rem;
		border-radius: 9999px;
		font-size: 0.68rem;
		font-weight: 600;
		background: rgba(0, 0, 0, 0.05);
		color: var(--color-neutral-500);
	}

	:global(.dark) .tech-tab-count {
		background: rgba(255, 255, 255, 0.08);
		color: var(--color-neutral-400);
	}

	.tech-panel {
		animation: tech-panel-in var(--motion-slow) var(--ease-out-soft) both;
	}

	@keyframes tech-panel-in {
		from {
			opacity: 0;
			transform: translateY(8px);
			filter: blur(4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
			filter: blur(0);
		}
	}

	.tech-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.75rem;
	}

	@media (min-width: 640px) {
		.tech-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (min-width: 1024px) {
		.tech-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	.tech-card {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		padding: 1rem 1rem 0.85rem;
		border-radius: var(--tech-card-radius);
		background: var(--color-neutral-100);
		box-shadow:
			inset 0 0 0 1px rgba(0, 0, 0, 0.04),
			0 1px 2px rgba(0, 0, 0, 0.03);
		transition:
			transform var(--motion-base) var(--ease-out-soft),
			box-shadow var(--motion-base) var(--ease-out-soft);
	}

	:global(.dark) .tech-card {
		background: var(--color-neutral-900);
		box-shadow:
			inset 0 0 0 1px rgba(255, 255, 255, 0.06),
			0 1px 2px rgba(0, 0, 0, 0.2);
	}

	/* Staggered scroll reveal — :global so data-in-view on the root matches */
	:global(.tech-stack[data-in-view='true']) .tech-card {
		animation: tech-card-in var(--motion-slow) var(--ease-out-soft) both;
		animation-delay: calc(var(--stagger-index) * 55ms);
	}

	@keyframes tech-card-in {
		from {
			opacity: 0;
			transform: translateY(12px);
			filter: blur(4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
			filter: blur(0);
		}
	}

	.tech-card-accent {
		position: absolute;
		top: 0.85rem;
		left: 0;
		width: 3px;
		height: 1.35rem;
		border-radius: 0 9999px 9999px 0;
		background: var(--tech-accent);
		opacity: 0.85;
	}

	.tech-card-top {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
		padding-left: 0.35rem;
	}

	.tech-card-title {
		font-size: 0.95rem;
		font-weight: 600;
		line-height: 1.35;
		color: var(--color-neutral-900);
		text-wrap: balance;
	}

	:global(.dark) .tech-card-title {
		color: var(--color-neutral-100);
	}

	.tech-card-link {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		margin: -0.45rem -0.35rem 0 0;
		border-radius: var(--tech-card-inner-radius);
		color: var(--color-neutral-500);
		transition:
			transform var(--motion-fast) var(--ease-out-soft),
			color var(--motion-fast) ease,
			background-color var(--motion-fast) ease;
	}

	.tech-card-link:focus-visible {
		outline: 2px solid color-mix(in oklab, var(--tech-accent) 70%, transparent);
		outline-offset: 2px;
	}

	.tech-card-link-icon {
		width: 1rem;
		height: 1rem;
		transition: transform var(--motion-base) var(--ease-out-soft);
	}

	.tech-card-description {
		padding-left: 0.35rem;
		font-size: 0.875rem;
		line-height: 1.55;
		color: var(--color-neutral-600);
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 3;
		overflow: hidden;
	}

	:global(.dark) .tech-card-description {
		color: var(--color-neutral-400);
	}

	.tech-card-more {
		align-self: flex-start;
		margin-left: 0.35rem;
		padding: 0.35rem 0.5rem;
		min-height: 2.5rem;
		border-radius: var(--tech-card-inner-radius);
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-neutral-500);
		transition:
			color var(--motion-fast) ease,
			transform var(--motion-fast) var(--ease-out-soft);
	}

	.tech-card-more:focus-visible {
		outline: 2px solid color-mix(in oklab, var(--tech-accent) 70%, transparent);
		outline-offset: 2px;
	}

	.tech-card-more:active {
		transform: scale(0.96);
	}

	/* Desktop: full description on hover, hide read-more */
	@media (hover: hover) and (pointer: fine) {
		.tech-card:hover {
			transform: translateY(-2px);
			box-shadow:
				inset 0 0 0 1px rgba(0, 0, 0, 0.04),
				0 10px 24px rgba(0, 0, 0, 0.06);
		}

		:global(.dark) .tech-card:hover {
			box-shadow:
				inset 0 0 0 1px rgba(255, 255, 255, 0.06),
				0 10px 24px rgba(0, 0, 0, 0.35);
		}

		.tech-card:hover .tech-card-description {
			-webkit-line-clamp: unset;
		}

		.tech-card-more {
			display: none;
		}

		.tech-card-link:hover {
			color: var(--color-neutral-900);
			background: rgba(0, 0, 0, 0.04);
		}

		:global(.dark) .tech-card-link:hover {
			color: var(--color-neutral-100);
			background: rgba(255, 255, 255, 0.06);
		}

		.tech-card-link:hover .tech-card-link-icon,
		.tech-card-link:focus-visible .tech-card-link-icon {
			transform: translate(1px, -1px);
		}

		.tech-card-link:active {
			transform: scale(0.96);
		}
	}

	/* Mobile: expand on tap */
	@media not all and (hover: hover), (pointer: coarse) {
		.tech-card-expanded .tech-card-description {
			-webkit-line-clamp: unset;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.tech-panel,
		:global(.tech-stack[data-in-view='true']) .tech-card {
			animation: none;
		}
	}
</style>
