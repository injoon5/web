<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import NumberFlow from '@number-flow/svelte';

	let likeCount = 0;
	let isLiked = false;
	let loading = true;
	let toggling = false;
	let currentPath = '';
	let likeError = '';
	let likeErrorTimer = null;
	let heartPopping = false;
	let heartPopTimer = null;

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
		try {
			const res = await fetch(`/api/likes?url=${encodeURIComponent($page.url.pathname)}`);
			if (res.ok) {
				const data = await res.json();
				likeCount = data.count;
				isLiked = data.liked;
			} else {
				showLikeError('Could not load likes.');
			}
		} catch {
			showLikeError('Could not load likes.');
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
				// Trigger heart pop on like (not unlike)
				if (isLiked) {
					if (heartPopTimer) clearTimeout(heartPopTimer);
					heartPopping = false;
					// Force reflow so re-adding the class restarts the animation
					requestAnimationFrame(() => {
						heartPopping = true;
						heartPopTimer = setTimeout(() => { heartPopping = false; }, 350);
					});
				}
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
	{#if loading}
		<span class="mr-2 h-6 w-16 animate-pulse rounded bg-neutral-300 dark:bg-neutral-700"></span>
	{:else}
		<span class="mr-2 text-lg text-neutral-900 dark:text-neutral-100" style="display: inline-flex; align-items: baseline;">
			<NumberFlow value={likeCount} trend={0} />
			<span class="ml-1">like{likeCount !== 1 ? 's' : ''}</span>
		</span>
	{/if}
	<button
		on:click={toggleLike}
		disabled={loading || toggling}
		class="inline-flex items-center gap-2 rounded-lg p-2 px-4 font-medium text-neutral-100 transition-all duration-300 hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50
			{isLiked ? 'bg-rose-600 dark:bg-rose-500' : 'bg-black dark:bg-white dark:text-neutral-900'}"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="h-4 w-4 {heartPopping ? 'like-pop' : ''} {isLiked ? 'fill-white' : 'fill-current'}"
			viewBox="0 0 20 20"
			aria-hidden="true"
		>
			{#if isLiked}
				<path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd" />
			{:else}
				<path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd" />
			{/if}
		</svg>
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
