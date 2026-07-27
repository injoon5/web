<script>
	/**
	 * The reading pile, arranged for the room it is in.
	 *
	 * Two big piles side by side on a wide screen, one on a phone. Both
	 * arrangements are rendered and swapped with a media query rather than
	 * measured in JavaScript, so the server sends the right thing and nothing
	 * reflows after hydration. Hover state is held here so the readout line
	 * below works from whichever arrangement is actually on screen.
	 *
	 * Past `limit` books the pile stops growing and the rest wait behind a
	 * button — a stack tall enough to scroll past is a wall, not a pile.
	 */
	import BookPile from './BookPile.svelte';
	import { formatMonth } from './bookMeta.js';

	let { books = [], limit = 12 } = $props();

	let expanded = $state(false);
	let hovered = $state(null);

	let shown = $derived(expanded ? books : books.slice(0, limit));
	let hiddenCount = $derived(Math.max(0, books.length - shown.length));

	/**
	 * Split the books into `count` piles in order, not round-robin: the newest
	 * book has to end up on top of the *first* pile, because that is the one the
	 * readout line underneath is talking about.
	 */
	function deal(count) {
		const n = Math.max(1, Math.min(count, shown.length));
		const size = Math.ceil(shown.length / n);
		const piles = [];
		for (let i = 0; i < shown.length; i += size) piles.push(shown.slice(i, i + size));
		return piles;
	}

	let one = $derived(deal(1));
	let two = $derived(deal(2));

	const enter = (book) => (hovered = book);
	const leave = (book) => {
		if (hovered === book) hovered = null;
	};

	let resting = $derived.by(() => {
		const reading = books.find((b) => b.reading);
		if (reading) return `Currently reading ${reading.title}`;
		const latest = books[0];
		if (!latest) return '';
		const when = formatMonth(latest.date);
		return when ? `Last finished ${latest.title} in ${when}` : latest.title;
	});
</script>

{#snippet arrangement(piles, columns)}
	<div class="grid items-end gap-x-12 gap-y-16" class:md:grid-cols-2={columns === 2}>
		{#each piles as pile, i (i)}
			<BookPile books={pile} onenter={enter} onleave={leave} />
		{/each}
	</div>
{/snippet}

<div class="md:hidden">
	{@render arrangement(one, 1)}
</div>
<div class="hidden md:block">
	{@render arrangement(two, 2)}
</div>

<div class="mt-6 flex items-baseline justify-between gap-4 text-sm leading-5 tracking-tight">
	<!-- One reserved line, cross-faded in place, so naming a book never nudges
	     the piles above it. -->
	<div class="grid min-w-0 flex-1">
		<p
			class="col-start-1 row-start-1 truncate text-neutral-500 transition-opacity duration-200 dark:text-neutral-500"
			class:opacity-0={hovered}
		>
			{resting}
		</p>
		<p
			class="col-start-1 row-start-1 truncate transition-opacity duration-200"
			class:opacity-0={!hovered}
			aria-hidden="true"
		>
			<span class="font-medium text-neutral-900 dark:text-neutral-100">{hovered?.title ?? ''}</span>
			{#if hovered?.author}
				<span class="text-neutral-500 dark:text-neutral-500">— {hovered.author}</span>
			{/if}
			{#if hovered?.date}
				<span class="tabular text-neutral-400 dark:text-neutral-600"
					>· {formatMonth(hovered.date)}</span
				>
			{/if}
		</p>
	</div>

	{#if hiddenCount > 0 || expanded}
		<button
			type="button"
			onclick={() => (expanded = !expanded)}
			class="shrink-0 font-medium text-neutral-600 underline decoration-neutral-300 underline-offset-4 transition-colors duration-100 hover:text-neutral-900 dark:text-neutral-500 dark:decoration-neutral-700 dark:hover:text-neutral-100"
		>
			{expanded ? 'Show fewer' : `Add ${hiddenCount} more to the pile`}
		</button>
	{/if}
</div>
