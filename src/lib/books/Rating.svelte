<script>
	/** Five marks, half steps supported. Monochrome, like everything else here. */
	import { ratingMarks } from './bookMeta.js';

	/**
	 * `labelled` is for the one place that already prints the number next to the
	 * stars — announcing it twice there is worse than not announcing it here.
	 */
	let { rating = 0, size = 12, labelled = true } = $props();

	const STAR = 'M12 2.6l2.9 5.95 6.6.9-4.8 4.6 1.2 6.5L12 17.5l-5.9 3.05 1.2-6.5-4.8-4.6 6.6-.9z';

	let marks = $derived(ratingMarks(rating));
	let uid = $props.id();
</script>

{#if marks.length}
	<!-- role="img" or the label is dropped: ARIA forbids naming a bare span, and
	     every star inside is aria-hidden, so there would be nothing left to read. -->
	<span
		class="inline-flex items-center gap-[2px] align-middle"
		role={labelled ? 'img' : undefined}
		aria-label={labelled ? `Rated ${rating} out of 5` : undefined}
		aria-hidden={labelled ? undefined : 'true'}
	>
		{#each marks as mark, i}
			<svg
				width={size}
				height={size}
				viewBox="0 0 24 24"
				aria-hidden="true"
				class="block shrink-0 text-neutral-800 dark:text-neutral-200"
			>
				{#if mark === 'half'}
					<defs>
						<linearGradient id="{uid}-{i}">
							<stop offset="50%" stop-color="currentColor" />
							<stop offset="50%" stop-color="currentColor" stop-opacity="0.18" />
						</linearGradient>
					</defs>
					<path d={STAR} fill="url(#{uid}-{i})" />
				{:else}
					<path d={STAR} fill="currentColor" opacity={mark === 'full' ? 1 : 0.18} />
				{/if}
			</svg>
		{/each}
	</span>
{/if}
