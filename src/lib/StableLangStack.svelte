<script>
	import { blur } from 'svelte/transition';

	const blurT = (node, params) => (params?.duration ? blur(node, params) : {});

	/** @type {string[]} */
	export let langs = [];
	export let displayLang = '';
	/** @type {(lang: string) => string} */
	export let text = () => '';
	/** @type {Record<string, unknown> | null | undefined} */
	export let transition = null;
	/** @type {'p' | 'span'} */
	export let as = 'span';
	/** @type {string} */
	export let className = '';
</script>

<div class="grid items-center {className}">
	{#each langs as l (`${l}-ghost`)}
		<svelte:element this={as} style="grid-area: 1 / 1" class="invisible" aria-hidden="true">
			{text(l)}
		</svelte:element>
	{/each}
	{#each [displayLang] as l (l)}
		<svelte:element
			this={as}
			style="grid-area: 1 / 1"
			in:blurT={transition}
			out:blurT={transition}
		>
			{text(l)}
		</svelte:element>
	{/each}
</div>
