<script>
	import NavBarButton from './NavBarButton.svelte';
</script>

<div class="flex items-center justify-between">
	<div class="flex items-center gap-2">
		<a href="/" class="text-black dark:text-white text-md p-0 font-serif text-lg font-normal">
			<div
				class="from-blue-300 to-blue-50 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-t transition hover:scale-110 ease-in-out duration-600"
			>
				<p class="text-blue-600 font-sans text-xl font-medium">IO</p>
			</div>
		</a>
	</div>
	<ul class="flex items-center gap-4">
		<NavBarButton linkto="/projects">projects</NavBarButton>
		<NavBarButton linkto="/blog">blog</NavBarButton>
		<NavBarButton linkto="http://github.com/injoon5">github</NavBarButton>
		<NavBarButton linkto="http://mastodon.injoon5.com">mastodon</NavBarButton
		>
	</ul>
</div>
