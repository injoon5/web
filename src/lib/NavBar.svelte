<script>
	import NavBarButton from './NavBarButton.svelte';
	let showMenu = false;

	function toggleNavbar() {
		showMenu = !showMenu;
	}
	function closeNavbar() {
		showMenu = false;
	}
</script>

<div class="flex items-center justify-between">
	<div class="flex items-center gap-2">
		<a href="/" class="text-black dark:text-white text-md p-0 font-serif text-lg font-normal">
			<div
				class="from-blue-300 to-blue-50 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-t"
			>
				<p class="text-blue-600 font-sans text-xl font-medium">IO</p>
			</div>
		</a>
	</div>
	<ul class="flex items-center gap-4">
		<NavBarButton linkto="/about" on:click={closeNavbar}>about</NavBarButton>
		<NavBarButton linkto="/projects" on:click={closeNavbar}>projects</NavBarButton>
		<NavBarButton linkto="/blog" on:click={closeNavbar}>blog</NavBarButton>
		<NavBarButton linkto="http://github.com/injoon5" on:click={closeNavbar}>github</NavBarButton>
		<NavBarButton linkto="http://mastodon.injoon5.com" on:click={closeNavbar}>mastodon</NavBarButton
		>
	</ul>
</div>
