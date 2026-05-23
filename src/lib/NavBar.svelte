<script>
	import { page } from '$app/state';
	import { createWebHaptics } from 'web-haptics/svelte';
	import { onDestroy, onMount } from 'svelte';
	import FolderGit2 from '@lucide/svelte/icons/folder-git-2';
	import Notebook from '@lucide/svelte/icons/notebook';
	import Sparkles from '@lucide/svelte/icons/sparkles';

	const { trigger, destroy } = createWebHaptics();
	onDestroy(destroy);

	const navItems = [
		{ label: 'projects', href: '/projects', icon: FolderGit2 },
		{ label: 'blog', href: '/blog', icon: Notebook },
		{ label: 'now', href: '/now', icon: Sparkles }
	];

	// Reveal the name in the navbar once we've scrolled past the hero
	// (Only home gets a true hero; on every other page the name shows immediately.)
	let nameVisible = $state(true);
	let scrolled = $state(false);
	let sentinel;

	onMount(() => {
		const isHome = page.url.pathname === '/';
		nameVisible = !isHome;

		function onScroll() {
			scrolled = window.scrollY > 8;
		}
		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });

		let observer;
		if (isHome) {
			// Sentinel sits at the top of the page; when it scrolls offscreen, reveal the name.
			sentinel = document.createElement('div');
			sentinel.setAttribute('aria-hidden', 'true');
			sentinel.style.cssText =
				'position:absolute;top:0;left:0;height:6rem;width:1px;pointer-events:none;';
			document.body.prepend(sentinel);
			observer = new IntersectionObserver(
				([entry]) => {
					nameVisible = !entry.isIntersecting;
				},
				{ threshold: 0 }
			);
			observer.observe(sentinel);
		}

		return () => {
			window.removeEventListener('scroll', onScroll);
			observer?.disconnect();
			sentinel?.remove();
		};
	});

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
		class="group inline-flex items-center"
	>
		<span class="relative inline-block">
			<span
				class="block font-sans text-2xl font-medium tracking-tight transition-[opacity,transform,filter] duration-200 ease-out
				{nameVisible ? 'opacity-100 translate-y-0 blur-0' : 'opacity-0 -translate-y-1 blur-sm'}
				group-hover:opacity-0 group-hover:blur-sm"
			>
				Injoon Oh
			</span>
			<span
				class="pointer-events-none absolute inset-0 block font-sans text-2xl font-semibold tracking-tight opacity-0 blur-sm transition-[opacity,filter] duration-200 ease-out group-hover:opacity-100 group-hover:blur-none"
			>
				오인준
			</span>
		</span>
	</a>

	<!-- Desktop nav links (hidden on mobile — floating dock takes over) -->
	<ul class="hidden items-center gap-4 sm:flex">
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

<!-- Mobile floating dock — only below sm -->
<nav
	aria-label="Primary"
	class="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 sm:hidden"
	style="padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 0.75rem);"
>
	<ul
		class="pointer-events-auto flex items-center gap-1 rounded-full border border-neutral-200/70 bg-white/80 px-1.5 py-1.5 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.18)] backdrop-blur-xl dark:border-neutral-800/70 dark:bg-neutral-950/75 dark:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)]"
	>
		{#each navItems as item}
			{@const Icon = item.icon}
			{@const active = isActive(item.href)}
			<li>
				<a
					href={item.href}
					onclick={() => trigger([{ duration: 30 }], { intensity: 0.9 })}
					aria-current={active ? 'page' : 'false'}
					class="relative flex h-11 min-w-[44px] items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors duration-150 active:scale-[0.97] {active
						? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
						: 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100'}"
				>
					<Icon size="16" strokeWidth="2" aria-hidden="true" />
					<span>{item.label}</span>
				</a>
			</li>
		{/each}
	</ul>
</nav>
