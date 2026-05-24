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
			text: el.textContent
				.replace(/^#+\s*/, '')
				.replace(/#\s*$/, '')
				.trim(),
			level: parseInt(el.tagName[1])
		}));

		if (headings.length === 0) return;

		// Pick the heading nearest to the top of the viewport (but not below it)
		// by tracking each heading's intersection with a top sliver of the viewport.
		const visible = new Map();
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) visible.set(entry.target.id, entry.boundingClientRect.top);
					else visible.delete(entry.target.id);
				}
				if (visible.size > 0) {
					let bestId = headings[0].id;
					let bestTop = -Infinity;
					for (const [id, top] of visible) {
						if (top <= 120 && top > bestTop) {
							bestTop = top;
							bestId = id;
						}
					}
					activeId = bestId;
				}
			},
			{ rootMargin: '0px 0px -85% 0px', threshold: 0 }
		);
		for (const el of els) observer.observe(el);
		activeId = headings[0].id;

		return () => observer.disconnect();
	});

	function scrollTo(id) {
		const el = document.getElementById(id);
		if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	const indent = { 1: 'pl-1', 2: 'pl-3', 3: 'pl-5' };
</script>

{#if headings.length > 1}
	<nav
		aria-label="Table of contents"
		class="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto"
	>
		<p
			class="mb-2 text-[10px] font-semibold tracking-widest text-neutral-400 uppercase dark:text-neutral-500"
		>
			On this page
		</p>
		<ul class="space-y-0">
			{#each headings as heading}
				<li>
					<button
						on:click={() => scrollTo(heading.id)}
						class="group relative flex w-full items-baseline py-0.5 text-left transition-colors duration-150 {indent[
							heading.level
						] ?? 'pl-5'}"
					>
						<!-- Active indicator bar -->
						<span
							class="absolute top-1/2 left-0 w-0.5 -translate-y-1/2 rounded-full transition-all duration-200
								{activeId === heading.id
								? 'h-3.5 bg-neutral-800 opacity-100 dark:bg-neutral-200'
								: 'h-2 bg-neutral-300 opacity-0 group-hover:opacity-100 dark:bg-neutral-600'}"
						></span>

						<span
							class="text-xs leading-snug transition-colors duration-150
								{activeId === heading.id
								? 'font-medium text-neutral-900 dark:text-neutral-100'
								: 'text-neutral-400 group-hover:text-neutral-700 dark:text-neutral-500 dark:group-hover:text-neutral-300'}"
						>
							{heading.text}
						</span>
					</button>
				</li>
			{/each}
		</ul>
	</nav>
{/if}
