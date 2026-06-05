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
		{ label: 'now', href: '/now' }
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

<div class="flex items-center justify-between">
	<a
		href="/"
		onclick={() => trigger([{ duration: 35 }], { intensity: 1 })}
		aria-label="Home — Injoon Oh"
		class="group inline-flex items-center {showName ? '' : 'pointer-events-none'}"
	>
		<span class="relative inline-block">
			<span
				class="block font-sans text-2xl font-medium tracking-tight will-change-auto group-hover:opacity-0 group-hover:blur-sm
				{mounted ? 'transition-[opacity,filter,transform] duration-200 ease-out' : ''}
				{showName ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'}"
			>
				Injoon Oh
			</span>
			<span
				class="pointer-events-none absolute inset-0 block font-sans text-2xl font-semibold tracking-tight opacity-0 blur-sm transition-[opacity,filter] duration-200 ease-out will-change-auto group-hover:opacity-100 group-hover:blur-none"
			>
				오인준
			</span>
		</span>
	</a>

	<ul class="flex items-center gap-4">
		{#each navItems as item}
			<li>
				<a
					href={item.href}
					onclick={() => trigger([{ duration: 25 }], { intensity: 0.7 })}
					class="p-0 text-base font-medium transition-colors duration-150 {isActive(item.href)
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
