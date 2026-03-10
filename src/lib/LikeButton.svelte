<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	let likeCount = 0;
	let isLiked = false;
	let loading = true;
	let currentPath = '';
	let animating = false;

	onMount(async () => {
		currentPath = $page.url.pathname;
		await loadLikeData();
	});

	$: if ($page.url.pathname !== currentPath && currentPath) {
		likeCount = 0;
		isLiked = false;
		loading = true;
		currentPath = $page.url.pathname;
		loadLikeData();
	}

	async function loadLikeData() {
		try {
			const res = await fetch(`/api/likes?url=${encodeURIComponent($page.url.pathname)}`);
			if (res.ok) {
				const data = await res.json();
				likeCount = data.count;
				isLiked = data.liked;
			}
		} catch {
			// silently fail
		} finally {
			loading = false;
		}
	}

	async function toggleLike() {
		try {
			const res = await fetch('/api/likes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: $page.url.pathname })
			});
			if (res.ok) {
				const data = await res.json();
				likeCount = data.count;
				isLiked = data.liked;
				if (data.liked) {
					animating = true;
					setTimeout(() => (animating = false), 350);
				}
			}
		} catch {
			// silently fail
		}
	}
</script>

<div class="flex items-center justify-between">
	<span class="mr-2 text-lg text-neutral-900 dark:text-neutral-100">
		{likeCount} like{likeCount !== 1 ? 's' : ''}
	</span>
	<button
		on:click={toggleLike}
		disabled={loading}
		class="rounded-lg bg-black p-2 px-4 font-medium text-neutral-100 transition-all duration-150 hover:bg-neutral-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200 {animating ? 'like-pop' : ''}"
	>
		{isLiked ? 'Unlike' : 'Like'}
	</button>
</div>
