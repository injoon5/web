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
		<a href="/" class="group text-md p-0 font-serif text-lg font-normal text-black dark:text-white">
			<span class="relative inline-block">
				<span
					class="block font-sans text-2xl font-medium tracking-tight transition-all duration-200 ease-in-out group-hover:opacity-0 group-hover:blur-sm"
				>
					Injoon Oh
				</span>
				<span
					class="pointer-events-none absolute left-0 top-0 block font-sans text-2xl font-medium tracking-tight opacity-0 blur-sm transition-all duration-200 ease-in-out group-hover:opacity-100 group-hover:blur-0"
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
					class="p-0 text-base font-medium text-neutral-500 hover:text-black md:p-1 dark:text-neutral-500 dark:hover:text-white"
					aria-current="page"
				>
					{item.label}
				</a>
			</li>
		{/each}
	</ul>
</div>
