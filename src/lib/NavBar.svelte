<script>
	import { page } from '$app/state';

	const navItems = [
		{ label: 'projects', href: '/projects' },
		{ label: 'blog', href: '/blog' },
		{ label: 'github', href: 'http://github.com/injoon5' }
	];
</script>

<div class="flex items-center justify-between">
	<div class="flex items-center gap-2">
		<a
			href="/"
			class="text-md group p-0 font-serif text-lg font-normal text-black dark:text-neutral-100"
		>
			<span class="relative inline-block">
				<span
					class="block font-sans text-2xl font-medium tracking-tight transition-all duration-200 ease-in-out group-hover:opacity-0 group-hover:blur-sm"
				>
					Injoon Oh
				</span>
				<span
					class="pointer-events-none absolute left-0 top-0 block font-sans text-2xl font-semibold tracking-tight opacity-0 blur-sm transition-all duration-200 ease-in-out group-hover:opacity-100 group-hover:blur-0"
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
					class="p-0 text-base font-medium {page.url.pathname.startsWith(item.href) ? 'text-neutral-900 dark:text-neutral-100' : 'text-neutral-500 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'} md:p-1"
					aria-current={page.url.pathname === item.href ? 'page' : 'false'}
				>
					{item.label}
				</a>
			</li>
		{/each}
</div>
