<script>
	import { inViewOnce } from '$lib/actions/inViewOnce.js';

	let { techstack = [] } = $props();

	// One item per category as the initial "highlights" view
	const highlights = $derived(
		techstack.map((cat) => cat.technologies[0]).filter(Boolean)
	);

	// null = highlights, number = category index
	let activeIndex = $state(null);

	const panelId = $derived(activeIndex === null ? 'highlights' : String(activeIndex));

	const items = $derived(
		activeIndex === null
			? highlights
			: (techstack[activeIndex]?.technologies ?? [])
	);

	function toggle(index) {
		activeIndex = activeIndex === index ? null : index;
	}

	function onTabKeydown(e, index) {
		let next = null;
		if (e.key === 'ArrowRight') next = (index + 1) % techstack.length;
		else if (e.key === 'ArrowLeft') next = (index - 1 + techstack.length) % techstack.length;
		else if (e.key === 'Home') next = 0;
		else if (e.key === 'End') next = techstack.length - 1;
		else return;
		e.preventDefault();
		activeIndex = next;
		e.currentTarget.closest('[role="tablist"]')
			?.querySelector(`[data-tab-index="${next}"]`)
			?.focus();
	}

	// Leaving panel: snap to absolute (so it doesn't hold layout height) then fade out.
	// Entering panel: fade + subtle rise in normal flow.
	function panelOut(node) {
		const { offsetTop, offsetLeft, offsetWidth } = node;
		node.style.position = 'absolute';
		node.style.top = offsetTop + 'px';
		node.style.left = offsetLeft + 'px';
		node.style.width = offsetWidth + 'px';
		node.style.pointerEvents = 'none';
		return { duration: 160, css: (t) => `opacity: ${t}` };
	}

	function panelIn(node) {
		return {
			duration: 200,
			css: (t, u) => `opacity: ${t}; transform: translateY(${u * 5}px)`
		};
	}

	// Animates the wrapper height to match its inner content whenever it resizes.
	// First measurement skips the transition so there's no flash on mount.
	function animateHeight(node) {
		const inner = node.firstElementChild;
		if (!inner || typeof ResizeObserver === 'undefined') return {};

		let ready = false;

		const ro = new ResizeObserver(() => {
			const h = inner.scrollHeight;
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
		return { destroy() { ro.disconnect(); } };
	}
</script>

<div use:inViewOnce class="ts-root">
	<div role="tablist" aria-label="Tech stack categories" class="ts-tabs">
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
				class:ts-tab-active={activeIndex === index}
				onclick={() => toggle(index)}
				onkeydown={(e) => onTabKeydown(e, index)}
			>
				{category.name}
			</button>
		{/each}
	</div>

	<div use:animateHeight class="ts-height-outer">
		<div class="ts-height-inner">
			{#key panelId}
				<div
					in:panelIn
					out:panelOut
					id="ts-panel"
					role="tabpanel"
					aria-label={activeIndex === null ? 'Highlights' : techstack[activeIndex]?.name}
					class="ts-panel"
				>
					{#each items as tech, i}
						<div class="ts-item" style="--i: {i}">
							<a
								href={tech.link}
								target="_blank"
								rel="noopener noreferrer"
								class="ts-name"
							>{tech.name}</a>
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
	.ts-tabs {
		display: flex;
		flex-wrap: nowrap;
		overflow-x: auto;
		overscroll-behavior-x: contain;
		scrollbar-width: none;
		gap: 0;
		margin-bottom: 0.75rem;
		/* Bleed-fade on the right so truncation is obvious */
		-webkit-mask-image: linear-gradient(to right, black calc(100% - 2rem), transparent 100%);
		mask-image: linear-gradient(to right, black calc(100% - 2rem), transparent 100%);
	}

	.ts-tabs::-webkit-scrollbar { display: none; }

	/* Remove fade when all tabs fit */
	@media (min-width: 640px) {
		.ts-tabs {
			flex-wrap: wrap;
			overflow-x: visible;
			-webkit-mask-image: none;
			mask-image: none;
		}
	}

	.ts-tab {
		flex-shrink: 0;
		padding: 0.25rem 0.6rem 0.25rem 0;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-neutral-400);
		white-space: nowrap;
		transition: color 120ms ease;
	}

	:global(.dark) .ts-tab { color: var(--color-neutral-500); }

	.ts-tab-active { color: var(--color-neutral-900); }

	:global(.dark) .ts-tab-active { color: var(--color-neutral-100); }

	@media (hover: hover) and (pointer: fine) {
		.ts-tab:not(.ts-tab-active):hover { color: var(--color-neutral-700); }
		:global(.dark) .ts-tab:not(.ts-tab-active):hover { color: var(--color-neutral-300); }
	}

	.ts-tab:focus-visible {
		outline: 2px solid var(--color-neutral-400);
		outline-offset: 2px;
		border-radius: 2px;
	}

	/* Dot separator */
	.ts-tab + .ts-tab::before {
		content: '·';
		padding-right: 0.6rem;
		color: var(--color-neutral-300);
		pointer-events: none;
		font-weight: 400;
	}

	:global(.dark) .ts-tab + .ts-tab::before { color: var(--color-neutral-700); }

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
		animation: ts-panel-in var(--motion-slow) var(--ease-out-soft) both;
	}

	@media (min-width: 640px) {
		.ts-panel { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	}

	@keyframes ts-panel-in {
		from { opacity: 0; transform: translateY(5px); }
		to   { opacity: 1; transform: translateY(0); }
	}

	/* --- Items --- */
	.ts-item {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	:global(.ts-root[data-in-view='true']) .ts-item {
		animation: ts-item-in 300ms var(--ease-out-soft) both;
		animation-delay: calc(var(--i) * 45ms);
	}

	@keyframes ts-item-in {
		from { opacity: 0; transform: translateY(6px); }
		to   { opacity: 1; transform: translateY(0); }
	}

	.ts-name {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-neutral-900);
		line-height: 1.3;
		text-decoration: none;
	}

	:global(.dark) .ts-name { color: var(--color-neutral-100); }

	@media (hover: hover) and (pointer: fine) {
		.ts-name:hover { text-decoration: underline; }
	}

	.ts-desc {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-neutral-600);
		line-height: 1.5;
	}

	:global(.dark) .ts-desc { color: var(--color-neutral-400); }

	@media (prefers-reduced-motion: reduce) {
		.ts-height-outer { transition: none; }
		.ts-panel, :global(.ts-root[data-in-view='true']) .ts-item { animation: none; }
	}
</style>
