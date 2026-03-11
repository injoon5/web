<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	let likeCount = 0;
	let isLiked = false;
	let loading = true;
	let toggling = false;
	let currentPath = '';
	let likeError = '';
	let likeErrorTimer = null;

	onMount(async () => {
		currentPath = $page.url.pathname;
		await loadLikeData();
	});

	$: if ($page.url.pathname !== currentPath && currentPath) {
		likeCount = 0;
		isLiked = false;
		loading = true;
		likeError = '';
		currentPath = $page.url.pathname;
		loadLikeData();
	}

	function showLikeError(message) {
		likeError = message;
		if (likeErrorTimer) clearTimeout(likeErrorTimer);
		likeErrorTimer = setTimeout(() => { likeError = ''; }, 3000);
	}

	async function loadLikeData() {
		const cacheKey = `likes:${$page.url.pathname}`;

		// Show cached state immediately
		const cached = sessionStorage.getItem(cacheKey);
		if (cached) {
			try {
				const data = JSON.parse(cached);
				likeCount = data.count;
				isLiked = data.liked;
				loading = false;
			} catch {}
		}

		// Always fetch fresh in the background
		try {
			const res = await fetch(`/api/likes?url=${encodeURIComponent($page.url.pathname)}`);
			if (res.ok) {
				const data = await res.json();
				likeCount = data.count;
				isLiked = data.liked;
				sessionStorage.setItem(cacheKey, JSON.stringify(data));
			} else if (!cached) {
				showLikeError('Could not load likes.');
			}
		} catch {
			if (!cached) showLikeError('Could not load likes.');
		} finally {
			loading = false;
		}
	}

	async function toggleLike() {
		toggling = true;
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
				sessionStorage.setItem(`likes:${$page.url.pathname}`, JSON.stringify(data));
			} else {
				const data = await res.json().catch(() => ({}));
				showLikeError(data.message ?? 'Could not save like.');
			}
		} catch {
			showLikeError('Something went wrong.');
		} finally {
			toggling = false;
		}
	}
</script>

<div class="flex items-center justify-between">
	<span class="mr-2 text-lg text-neutral-900 dark:text-neutral-100" style="display: inline-flex; align-items: baseline; overflow: hidden;">
		<span style="display: inline-block; overflow: hidden; height: 1.5rem; line-height: 1.5rem;">
			{#key likeCount}
				<span class="count-animate inline-block">{likeCount}</span>
			{/key}
		</span>
		<span class="ml-1">like{likeCount !== 1 ? 's' : ''}</span>
	</span>
	<button
		on:click={toggleLike}
		disabled={loading || toggling}
		class="rounded-lg bg-black p-2 px-4 font-medium text-neutral-100 transition-all duration-150 hover:bg-neutral-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
	>
		{#if toggling}
			{isLiked ? 'Unliking…' : 'Liking…'}
		{:else}
			{isLiked ? 'Unlike' : 'Like'}
		{/if}
	</button>
</div>
{#if likeError}
	<p class="mt-2 text-sm text-red-500">{likeError}</p>
{/if}
