<script>
	import NavBarButton from './NavBarButton.svelte';
</script>

<div class="flex items-center justify-between">
	<div class="flex items-center gap-2">
		<a href="/" class="text-md p-0 font-serif text-lg font-normal text-black dark:text-white">
			<div
				class="duration-600 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-t from-blue-300 to-blue-50 transition ease-in-out hover:scale-110"
			>
				<p class="font-sans text-xl font-medium text-blue-600">IO</p>
			</div>
		</a>
	</div>
	<ul class="flex items-center gap-4">
		<NavBarButton linkto="/projects">projects</NavBarButton>
		<NavBarButton linkto="/blog">blog</NavBarButton>
		<NavBarButton linkto="http://github.com/injoon5">github</NavBarButton>
		<NavBarButton linkto="http://mastodon.injoon5.com">mastodon</NavBarButton>
	</ul>
</div>
