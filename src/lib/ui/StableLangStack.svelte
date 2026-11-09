<script>
	import { swapBlur } from '#lib/ui/swap-blur.js';

	/**
	 * @type {{
	 *   langs?: string[];
	 *   displayLang?: string;
	 *   text?: (lang: string) => string;
	 *   transition?: import('svelte/transition').BlurParams | null;
	 * }}
	 */
	let { langs = [], displayLang = '', text = () => '', transition = null } = $props();
</script>

<!-- A span, not a div: it sits inside inline text (a byline), where a div is
     invalid HTML. `display: grid` works the same on either. -->
<span class="grid items-center">
	{#each langs as l (`${l}-ghost`)}
		<span style="grid-area: 1 / 1" class="invisible" aria-hidden="true">{text(l)}</span>
	{/each}
	{#each [displayLang] as l (l)}
		<span style="grid-area: 1 / 1" in:swapBlur={transition} out:swapBlur={transition}
			>{text(l)}</span
		>
	{/each}
</span>
