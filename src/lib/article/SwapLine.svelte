<script>
	/**
	 * One line of an article's header that changes with the language. Scritto
	 * rolls the glyphs that differ and holds the ones both languages share; the
	 * box eases between the two heights when the text rewraps.
	 */
	import Scritto from '@scritto/svelte';
	import { autoHeight } from '#lib/actions/auto-height.js';

	/**
	 * @type {{
	 *   displayLang: string;
	 *   text: (lang: string) => unknown;
	 *   height: { duration: number; enabled: boolean };
	 *   tag?: string;
	 *   class?: string;
	 *   outerClass?: string;
	 * }}
	 */
	let { displayLang, text, height, tag = 'p', class: className = '', outerClass = '' } = $props();

	const value = $derived(String(text(displayLang) ?? ''));
</script>

<div class="overflow-hidden {outerClass}" use:autoHeight={height}>
	<div class="grid" data-auto-height-inner>
		<svelte:element this={tag} class={className}>
			<Scritto class="scritto-wrap" {value} />
		</svelte:element>
	</div>
</div>
