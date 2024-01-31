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
	class="mx-auto flex max-w-4xl flex-wrap items-center justify-between border-gray-200 px-2 pb-4 md:px-6"
>
	<button
		on:click={toggleNavbar}
		type="button"
		class="inline-flex h-10 w-10 items-center justify-center rounded-lg p-2 text-sm text-gray-400 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600 md:hidden"
		aria-controls="navbar-default"
		aria-expanded="false"
	>
		<span class="sr-only">Open main menu</span>
		<svg
			class="h-5 w-5"
			aria-hidden="true"
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 17 14"
		>
			<path
				stroke="currentColor"
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M1 1h15M1 7h15M1 13h15"
			/>
		</svg>
	</button>
	<div class="w-full md:block md:w-auto {showMenu ? '' : 'hidden'}" id="navbar-default">
		<ul
			class="mt-4 flex flex-col rounded-lg border border-gray-700 p-4 text-lg font-medium md:mt-0 md:flex-row md:space-x-8 md:border-0 md:p-0 md:text-xl rtl:space-x-reverse"
		>
			<NavBarButton linkto="/" on:click={closeNavbar}>Home</NavBarButton>
			<NavBarButton linkto="/projects" on:click={closeNavbar}>Projects</NavBarButton>
			<NavBarButton linkto="/blog" on:click={closeNavbar}>Blog</NavBarButton>
			<NavBarButton linkto="/daily" on:click={closeNavbar}>Daily</NavBarButton>
		</ul>
	</div>
</div>
