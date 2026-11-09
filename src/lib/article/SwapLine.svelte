<script>
	/**
	 * One line of an article's header that changes with the language: the outgoing
	 * text blurs out while the incoming one blurs in over the same grid cell, and
	 * the box eases between their heights.
	 */
	import { swapBlur } from '#lib/ui/swap-blur.js';
	import { autoHeight } from '#lib/actions/auto-height.js';

	/**
	 * @type {{
	 *   displayLang: string;
	 *   text: (lang: string) => unknown;
	 *   transition: { duration: number } & Record<string, unknown>;
	 *   height: { duration: number; enabled: boolean };
	 *   tag?: string;
	 *   class?: string;
	 *   outerClass?: string;
	 * }}
	 */
	let {
		displayLang,
		text,
		transition,
		height,
		tag = 'p',
		class: className = '',
		outerClass = ''
	} = $props();

	// When duration is 0 (initial load / reduced motion) return an empty config so
	// NO starting style is applied — a zero-length blur still paints its opacity-0
	// start frame, which looked like a blink on load.
</script>

<div class="overflow-hidden {outerClass}" use:autoHeight={height}>
	<div class="grid" data-auto-height-inner>
		{#each [displayLang] as l (l)}
			<svelte:element
				this={tag}
				style="grid-area: 1 / 1;"
				in:swapBlur={transition}
				out:swapBlur={transition}
				class={className}
			>
				{text(l)}
			</svelte:element>
		{/each}
	</div>
</div>
