<script>
	import NumberFlow from '@number-flow/svelte';

	/** @type {string[]} */
	export let langs = [];
	export let displayLang = '';
	/** @type {(lang: string) => string | null | undefined} */
	export let readingTimeFor = () => '';
	/** @type {boolean} */
	export let animate = true;

	function minutesFor(l) {
		return parseInt(readingTimeFor(l) ?? '', 10) || 0;
	}

	function suffixFor(l) {
		return l === 'ko' ? '분 읽기' : ' min read';
	}

	$: readingMinutes = minutesFor(displayLang);
	$: suffix = suffixFor(displayLang);
</script>

<span class="tabular inline-flex whitespace-nowrap">
	<span class="grid shrink-0 leading-none">
		{#each langs as l (`${l}-readtime-ghost`)}
			<span style="grid-area: 1 / 1" class="invisible" aria-hidden="true">
				{minutesFor(l)}{suffixFor(l)}
			</span>
		{/each}
		<span style="grid-area: 1 / 1">
			<NumberFlow value={readingMinutes} {suffix} trend={0} animated={animate} />
		</span>
	</span>
</span>
