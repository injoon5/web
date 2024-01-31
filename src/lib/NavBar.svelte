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

<div
	class="mx-auto flex max-w-4xl flex-wrap items-center justify-between border-gray-200 px-4 py-3 md:px-5"
>
	<div class="block w-auto" id="navbar-default">
		<ul
			class="mt-0 flex flex-row space-x-6 rounded-lg border-0 p-0 text-lg font-medium md:space-x-8 md:text-xl rtl:space-x-reverse"
		>
			<NavBarButton linkto="/" on:click={closeNavbar}>Home</NavBarButton>
			<NavBarButton linkto="/projects" on:click={closeNavbar}>Projects</NavBarButton>
			<NavBarButton linkto="/blog" on:click={closeNavbar}>Blog</NavBarButton>
			<NavBarButton linkto="/daily" on:click={closeNavbar}>Daily</NavBarButton>
		</ul>
	</div>
</div>
