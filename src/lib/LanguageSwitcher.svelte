<script>
	import { onMount, tick } from 'svelte';

	export let availableLangs = [];
	export let lang = 'ko';
	export let mounted = false;
	/** @type {(lang: string) => void} */
	export let onselect = () => {};

	/** @type {Record<string, HTMLButtonElement>} */
	let langButtons = {};
	let pillStyle = '';
	let clipStyle = '';

	async function updatePill() {
		await tick();
		const el = langButtons[lang];
		if (!el) return;
		const parent = el.parentElement;
		if (!parent) return;
		const parentRect = parent.getBoundingClientRect();
		const rect = el.getBoundingClientRect();
		const left = rect.left - parentRect.left;
		const right = parentRect.width - (left + rect.width);
		pillStyle = `transform: translateX(${left}px); width: ${rect.width}px; opacity: 1;`;
		clipStyle = `clip-path: inset(4px ${right}px 4px ${left}px round 9999px); opacity: 1;`;
	}

	$: (lang, updatePill());

	onMount(() => {
		updatePill();
		const ro = new ResizeObserver(updatePill);
		const container = Object.values(langButtons)[0]?.parentElement;
		if (container) ro.observe(container);
		return () => ro.disconnect();
	});
</script>

{#if availableLangs.length > 1}
	<div
		class="relative mt-3 inline-flex items-center gap-1 rounded-full border border-neutral-200/70 bg-neutral-100/60 p-1 dark:border-neutral-800/70 dark:bg-neutral-900/60"
	>
		<span
			class="nav-indicator pointer-events-none absolute top-1 bottom-1 left-0 rounded-full bg-neutral-900 dark:bg-neutral-100"
			class:nav-animate={mounted}
			style={pillStyle || 'opacity:0;'}
			aria-hidden="true"
		></span>
		{#each availableLangs as l}
			<button
				bind:this={langButtons[l]}
				on:click={() => onselect(l)}
				aria-pressed={l === lang}
				class="relative z-10 rounded-full px-3 {l === 'en'
					? 'mr-0.5'
					: ''} py-1 text-sm font-semibold text-neutral-500 transition-colors duration-150 hover:text-neutral-900 dark:hover:text-neutral-100"
			>
				{l === 'en' ? 'English' : '한국어'}
			</button>
		{/each}
		<div
			class="nav-clip pointer-events-none absolute inset-0 z-20 flex items-center gap-1 p-1"
			class:nav-animate={mounted}
			style={clipStyle || 'clip-path: inset(4px 100% 4px 0 round 9999px);'}
			aria-hidden="true"
		>
			{#each availableLangs as l}
				<span
					class="rounded-full px-3 {l === 'en'
						? 'mr-0.5'
						: ''} py-1 text-sm font-semibold text-white dark:text-neutral-900"
				>
					{l === 'en' ? 'English' : '한국어'}
				</span>
			{/each}
		</div>
	</div>
{/if}
