<script>
	import { onMount } from 'svelte';

	let headings = [];
	let activeId = '';

	onMount(() => {
		const article = document.querySelector('.readtime');
		if (!article) return;

		const els = Array.from(article.querySelectorAll('h1, h2, h3')).filter((el) => el.id);

		headings = els.map((el) => ({
			id: el.id,
			text: el.textContent.replace(/^#+\s*/, '').replace(/#\s*$/, '').trim(),
			level: parseInt(el.tagName[1])
		}));

		if (headings.length === 0) return;

		// Track the last heading that crossed the top of the viewport
		const onScroll = () => {
			let current = headings[0].id;
			for (const h of headings) {
				const el = document.getElementById(h.id);
				if (!el) continue;
				if (el.getBoundingClientRect().top <= 120) {
					current = h.id;
				}
			}
			activeId = current;
		};

		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
	});

	function scrollTo(id) {
		const el = document.getElementById(id);
		if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	const indent = { 1: 'pl-1', 2: 'pl-3', 3: 'pl-5' };
</script>

{#if headings.length > 1}
	<nav aria-label="Table of contents" class="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto">
		<p class="mb-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
			On this page
		</p>
		<ul class="space-y-0">
			{#each headings as heading}
				<li>
					<button
						on:click={() => scrollTo(heading.id)}
						class="group relative flex w-full items-baseline py-0.5 text-left transition-colors duration-150 {indent[heading.level] ?? 'pl-5'}"
					>
						<!-- Active indicator bar -->
						<span
							class="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-full transition-all duration-200
								{activeId === heading.id
									? 'h-3.5 bg-neutral-800 dark:bg-neutral-200 opacity-100'
									: 'h-2 bg-neutral-300 dark:bg-neutral-600 opacity-0 group-hover:opacity-100'}"
						></span>

						<span
							class="text-xs leading-snug transition-colors duration-150
								{activeId === heading.id
									? 'text-neutral-900 dark:text-neutral-100 font-medium'
									: 'text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-700 dark:group-hover:text-neutral-300'}"
						>
							{heading.text}
						</span>
					</button>
				</li>
			{/each}
		</ul>
	</nav>
{/if}
