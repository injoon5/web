<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import PocketBase from 'pocketbase';

	const pb = new PocketBase('https://pb.injoon5.com');

	let likeCount = 0;
	let isLiked = false;
	let likeRecord = null;
	let currentPath = '';

	onMount(async () => {
		currentPath = $page.url.pathname;
		await loadLikeData();
	});

	// Watch for route changes
	$: if ($page.url.pathname !== currentPath) {
		likeCount = 0;
		isLiked = false;
		likeRecord = null;
		currentPath = $page.url.pathname;
		loadLikeData();
	}

	async function loadLikeData() {
		try {
			const records = await pb.collection('likes').getList(1, 1, {
				filter: `url = "${$page.url.pathname}"`
			});

			if (records.items.length > 0) {
				likeRecord = records.items[0];
				likeCount = likeRecord.user?.length || 0;
				if (pb.authStore.isValid) {
					isLiked = likeRecord.user?.includes(pb.authStore.model.id) || false;
				}
			}
		} catch (error) {
			// console.error('Error loading like data:', error);
		}
	}

	async function toggleLike() {
		if (!pb.authStore.isValid) {
			alert('Please log in to like posts.');
			window.location.href = '/auth?goto=' + $page.url.pathname;
			return;
		}

		try {
			if (!likeRecord) {
				// Create a new record if it doesn't exist
				likeRecord = await pb.collection('likes').create({
					url: $page.url.pathname,
					user: [pb.authStore.model.id]
				});
				isLiked = true;
				likeCount = 1;
			} else {
				let users = likeRecord.user || [];
				if (isLiked) {
					// Unlike: remove user from the array
					users = users.filter((id) => id !== pb.authStore.model.id);
				} else {
					// Like: add user to the array
					if (!users.includes(pb.authStore.model.id)) {
						users.push(pb.authStore.model.id);
					}
				}
				// Update the existing record
				await pb.collection('likes').update(likeRecord.id, {
					user: users
				});
				isLiked = !isLiked;
				likeCount = users.length;
			}
		} catch (error) {
			console.error('Error toggling like:', error);
			alert('Failed to update like status. Please try again.');
		}
	}
</script>

<div class="flex items-center justify-between">
	<span class="mr-2 text-lg text-neutral-900 dark:text-neutral-100"
		>{likeCount} like{likeCount != 1 ? 's' : ''}</span
	>
	{#if pb.authStore.isValid}
		<button
			on:click={toggleLike}
			class="rounded-lg bg-black p-2 px-4 font-medium text-neutral-100 hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
		>
			{isLiked ? 'Unlike' : 'Like'}
		</button>
	{:else}
		<a
			href="/auth?goto={$page.url.pathname}"
			class="font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-100"
		>
			Log in to like
		</a>
	{/if}
</div>
