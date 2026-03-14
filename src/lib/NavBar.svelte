<script>
	import { page } from '$app/state';
	import { createWebHaptics } from 'web-haptics/svelte';
	import { onDestroy } from 'svelte';
	import { lang } from '$lib/stores/lang.js';
	import { t } from '$lib/i18n/index.js';

	const { trigger, destroy } = createWebHaptics();
	onDestroy(destroy);

	$: navItems = [
		{ label: $t.nav.projects, href: '/projects' },
		{ label: $t.nav.blog, href: '/blog' },
		{ label: $t.nav.github, href: 'http://github.com/injoon5' }
	];

	function toggleLang() {
		lang.update((l) => (l === 'en' ? 'ko' : 'en'));
		trigger([{ duration: 25 }], { intensity: 0.7 });
	}
</script>

<div class="flex items-center justify-between">
	<div class="flex items-center gap-2">
		<a
			href="/"
			onclick={() => trigger([{ duration: 35 }], { intensity: 1 })}
			class="text-md group p-0 font-serif text-lg font-normal text-neutral-900 dark:text-neutral-50"
		>
			<span class="relative inline-block">
				<span
					class="block font-sans text-2xl font-medium tracking-tight
             transition-all duration-200 ease-in-out
             {$lang === 'ko' ? 'opacity-0 blur-sm' : 'opacity-100 blur-none'}"
				>
					Injoon Oh
				</span>

				<span
					class="pointer-events-none absolute inset-0 block font-sans text-2xl font-semibold tracking-tight
             transition-all duration-200 ease-in-out
             {$lang === 'ko' ? 'opacity-100 blur-none' : 'opacity-0 blur-sm'}"
				>
					오인준
				</span>
			</span>
		</a>
	</div>

	<ul class="flex items-center gap-4">
		{#each navItems as item}
			<li>
				<a
					href={item.href}
					onclick={() => trigger([{ duration: 25 }], { intensity: 0.7 })}
					class="p-0 text-base font-medium {page.url.pathname.startsWith(item.href)
						? 'text-neutral-900 dark:text-neutral-100'
						: 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-100'} md:p-1"
					aria-current={page.url.pathname === item.href ? 'page' : 'false'}
				>
					{item.label}
				</a>
			</li>
		{/each}
		<li>
			<button
				onclick={toggleLang}
				class="p-0 text-base font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-100 md:p-1"
				aria-label="Toggle language"
			>
				{$lang === 'en' ? '한국어' : 'EN'}
			</button>
		</li>
	</ul>
</div>
