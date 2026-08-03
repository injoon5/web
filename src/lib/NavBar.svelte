<script>
	import { page } from '$app/state';
	import { createWebHaptics } from 'web-haptics/svelte';
	import { onMount, onDestroy } from 'svelte';
	import { heroNameVisible } from '$lib/heroNav.js';

	const { trigger, destroy } = createWebHaptics();
	onDestroy(destroy);

	let mounted = $state(false);
	onMount(() => {
		mounted = true;
	});

	const navItems = [
		{ label: 'projects', href: '/projects' },
		{ label: 'blog', href: '/blog' },
		{ label: 'now', href: '/now' },
		{ label: 'health', href: '/health' }
	];

	// On the home page the hero owns the name, so the navbar name stays hidden
	// until the hero scrolls out of view (tracked by heroNameVisible). Every
	// other page shows it immediately.
	let isHome = $derived(page.url.pathname === '/');
	let showName = $derived(!isHome || !$heroNameVisible);

	function isActive(href) {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(href);
	}
</script>

<!-- The header's priority order, expressed as layout rather than hoped for: the
     nav never shrinks, the wordmark does. A fourth link took the row to exactly
     the available width at 320px, and the thing that should give way when a
     phone gets narrower than that is the name — it is decoration next to a set
     of links that are the only way around the site. `min-w-0` is what lets it. -->
<div class="flex items-center justify-between gap-3">
	<a
		href="/"
		onclick={() => trigger([{ duration: 35 }], { intensity: 1 })}
		aria-label="Home — Injoon Oh"
		class="group inline-flex min-w-0 items-center {showName ? '' : 'pointer-events-none'}"
	>
		<span class="relative block min-w-0">
			<span
				class="block truncate font-sans text-xl font-medium tracking-tight will-change-auto group-hover:opacity-0 group-hover:blur-sm sm:text-2xl
				{mounted ? 'transition-[opacity,filter,transform] duration-200 ease-out' : ''}
				{showName ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'}"
			>
				Injoon Oh
			</span>
			<span
				class="pointer-events-none absolute inset-0 block truncate font-sans text-xl font-semibold tracking-tight opacity-0 blur-sm transition-[opacity,filter] duration-200 ease-out will-change-auto group-hover:opacity-100 group-hover:blur-none sm:text-2xl"
			>
				오인준
			</span>
		</span>
	</a>

	<ul class="flex shrink-0 items-center gap-3 sm:gap-4">
		{#each navItems as item}
			<li>
				<a
					href={item.href}
					onclick={() => trigger([{ duration: 25 }], { intensity: 0.7 })}
					class="p-0 text-sm font-medium transition-colors duration-150 sm:text-base {isActive(
						item.href
					)
						? 'text-neutral-900 dark:text-neutral-100'
						: 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-100'} md:p-1"
					aria-current={isActive(item.href) ? 'page' : 'false'}
				>
					{item.label}
				</a>
			</li>
		{/each}
	</ul>
</div>
