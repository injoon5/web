<script>
	import BookPiles from '$lib/books/BookPiles.svelte';
	import Rating from '$lib/books/Rating.svelte';
	import { formatMonth } from '$lib/books/bookMeta.js';

	export let data;
</script>

<svelte:head>
	<title>Books - Injoon Oh</title>
	<meta
		name="description"
		content="Everything I have read and had something to say about. Notes, ratings, and the occasional argument with the author."
	/>
	<meta property="og:title" content="Books - Injoon Oh" />
	<meta
		property="og:description"
		content="Everything I have read and had something to say about. Notes, ratings, and the occasional argument with the author."
	/>
	<meta property="og:image" content="https://www.injoon5.com/api/og?template=books" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:image" content="https://www.injoon5.com/api/og?template=books" />
	<meta property="og:url" content="https://www.injoon5.com/books" />
</svelte:head>

<div class="col-span-1 justify-center pt-10 lg:col-span-8 lg:col-start-3">
	<h1
		class="mt-20 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-2xl dark:text-neutral-100"
	>
		Books
	</h1>
	<h2 class="text-xl font-medium tracking-tight text-neutral-500 sm:text-xl dark:text-neutral-500">
		Everything I have read and had something to say about. <br />Take one off the top.
	</h2>

	{#if data.books.length}
		<div class="mt-16">
			<BookPiles books={data.books} />
		</div>

		<div class="mt-16 grid w-full grid-cols-1 divide-y divide-neutral-200 dark:divide-neutral-700">
			{#each data.books as book (book.slug)}
				<div class="py-2">
					<a
						href="/books/{book.slug}"
						class="group flex flex-row items-baseline justify-between gap-3"
					>
						<span class="flex min-w-0 flex-wrap items-baseline gap-x-2">
							<span
								class="line-clamp-1 text-base font-medium text-neutral-900 group-hover:text-neutral-600 group-hover:underline dark:text-neutral-100 dark:group-hover:text-neutral-400"
							>
								{book.title}
							</span>
							{#if book.author}
								<span
									class="line-clamp-1 text-base font-medium text-neutral-500 dark:text-neutral-500"
								>
									{book.author}
								</span>
							{/if}
							{#if book.hasEn}
								<span
									class="shrink-0 text-xs font-semibold tracking-wide text-neutral-400 uppercase dark:text-neutral-600"
								>
									EN
								</span>
							{/if}
						</span>
						<span class="ml-4 flex shrink-0 items-center gap-3">
							<!-- Stars cost more width than they earn on a phone; the title needs it.
							     They are hidden with `display:none`, so the rating is spoken from
							     here instead of from the marks. -->
							{#if book.rating}
								<span class="sr-only">Rated {book.rating} out of 5</span>
							{/if}
							<span class="hidden sm:inline-flex">
								<Rating rating={book.rating} labelled={false} />
							</span>
							<span
								class="tabular text-base font-medium whitespace-nowrap text-neutral-500 group-hover:text-neutral-600 dark:text-neutral-400 dark:group-hover:text-neutral-500"
							>
								{book.reading ? 'Reading' : formatMonth(book.date)}
							</span>
						</span>
					</a>
				</div>
			{/each}
		</div>
	{:else}
		<p class="mt-10 text-base text-neutral-500 dark:text-neutral-500">Nothing on the pile yet.</p>
	{/if}
</div>
