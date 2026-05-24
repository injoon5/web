<script>
	import { inViewOnce } from '$lib/actions/inViewOnce.js';

	let { techstack = [] } = $props();

	let activeIndex = $state(0);

	const activeCategory = $derived(techstack[activeIndex] ?? techstack[0]);

	function onTabKeydown(event, index) {
		let next = index;
		if (event.key === 'ArrowRight') next = (index + 1) % techstack.length;
		else if (event.key === 'ArrowLeft') next = (index - 1 + techstack.length) % techstack.length;
		else if (event.key === 'Home') next = 0;
		else if (event.key === 'End') next = techstack.length - 1;
		else return;
		event.preventDefault();
		activeIndex = next;
		event.currentTarget.closest('[role="tablist"]')
			?.querySelector(`[data-tab-index="${next}"]`)
			?.focus();
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
				aria-controls="ts-panel-{index}"
				tabindex={activeIndex === index ? 0 : -1}
				class="ts-tab"
				class:ts-tab-active={activeIndex === index}
				onclick={() => { activeIndex = index; }}
				onkeydown={(e) => onTabKeydown(e, index)}
			>
				{category.name}
			</button>
		{/each}
	</div>

	{#key activeIndex}
		<div
			id="ts-panel-{activeIndex}"
			role="tabpanel"
			aria-labelledby="ts-tab-{activeIndex}"
			class="ts-panel"
		>
			{#each activeCategory.technologies as tech, i}
				<a
					href={tech.link}
					target="_blank"
					rel="noopener noreferrer"
					class="ts-item"
					style="--i: {i}"
				>
					<span class="ts-name">{tech.name}</span>
					<span class="ts-desc text-pretty">{tech.description}</span>
				</a>
			{/each}
		</div>
	{/key}
</div>

<style>
	/* --- Tabs --- */
	.ts-tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.15rem 0;
		margin-bottom: 0.75rem;
	}

	.ts-tab {
		padding: 0.25rem 0.6rem 0.25rem 0;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-neutral-400);
		transition: color 120ms ease;
	}

	:global(.dark) .ts-tab {
		color: var(--color-neutral-500);
	}

	.ts-tab-active {
		color: var(--color-neutral-900);
	}

	:global(.dark) .ts-tab-active {
		color: var(--color-neutral-100);
	}

	@media (hover: hover) and (pointer: fine) {
		.ts-tab:not(.ts-tab-active):hover {
			color: var(--color-neutral-700);
		}

		:global(.dark) .ts-tab:not(.ts-tab-active):hover {
			color: var(--color-neutral-300);
		}
	}

	.ts-tab:focus-visible {
		outline: 2px solid var(--color-neutral-400);
		outline-offset: 2px;
		border-radius: 2px;
	}

	/* Dot separator between tabs */
	.ts-tab + .ts-tab::before {
		content: '·';
		padding-right: 0.6rem;
		color: var(--color-neutral-300);
		pointer-events: none;
		font-weight: 400;
	}

	:global(.dark) .ts-tab + .ts-tab::before {
		color: var(--color-neutral-700);
	}

	/* --- Panel --- */
	.ts-panel {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.35rem;
		animation: ts-panel-in var(--motion-slow) var(--ease-out-soft) both;
	}

	@media (min-width: 640px) {
		.ts-panel {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@keyframes ts-panel-in {
		from { opacity: 0; transform: translateY(6px); }
		to   { opacity: 1; transform: translateY(0); }
	}

	/* --- Items --- */
	.ts-item {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 0.75rem 1rem;
		background: var(--color-neutral-100);
		color: inherit;
		text-decoration: none;
		transition: background-color 120ms ease;
	}

	:global(.dark) .ts-item {
		background: var(--color-neutral-900);
	}

	/* Staggered reveal when section enters viewport */
	:global(.ts-root[data-in-view='true']) .ts-item {
		animation: ts-item-in 320ms var(--ease-out-soft) both;
		animation-delay: calc(var(--i) * 40ms);
	}

	@keyframes ts-item-in {
		from { opacity: 0; transform: translateY(8px); }
		to   { opacity: 1; transform: translateY(0); }
	}

	.ts-name {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-neutral-900);
		line-height: 1.3;
	}

	:global(.dark) .ts-name {
		color: var(--color-neutral-100);
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

	@media (hover: hover) and (pointer: fine) {
		.ts-item:hover {
			background: var(--color-neutral-200);
		}

		:global(.dark) .ts-item:hover {
			background: var(--color-neutral-800);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.ts-panel,
		:global(.ts-root[data-in-view='true']) .ts-item {
			animation: none;
		}
	}
</style>
