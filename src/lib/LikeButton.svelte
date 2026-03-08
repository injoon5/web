<script>
import { page } from "$app/stores";
import { onMount } from "svelte";
import PocketBase from "pocketbase";

const pb = new PocketBase("https://pb.injoon5.com");

let likeCount = 0;
let isLiked = false;
let likeRecord = null;
let currentPath = "";

let popping = false;
let showFloatingPlus = false;

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
		const records = await pb.collection("likes").getList(1, 1, {
			filter: `url = "${$page.url.pathname}"`,
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
		alert("Please log in to like posts.");
		window.location.href = "/auth?goto=" + $page.url.pathname;
		return;
	}

	const wasLiked = isLiked;

	try {
		if (!likeRecord) {
			// Create a new record if it doesn't exist
			likeRecord = await pb.collection("likes").create({
				url: $page.url.pathname,
				user: [pb.authStore.model.id],
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
			await pb.collection("likes").update(likeRecord.id, {
				user: users,
			});
			isLiked = !isLiked;
			likeCount = users.length;
		}

		// Trigger micro-interactions only when liking (not unliking)
		if (!wasLiked) {
			popping = false;
			showFloatingPlus = false;
			// Force reflow so re-clicking replays the animation
			requestAnimationFrame(() => {
				popping = true;
				showFloatingPlus = true;
				setTimeout(() => { popping = false; }, 400);
				setTimeout(() => { showFloatingPlus = false; }, 700);
			});
		}
	} catch (error) {
		console.error("Error toggling like:", error);
		alert("Failed to update like status. Please try again.");
	}
}
</script>

<div class="flex items-center justify-between">
	<span class="mr-2 text-lg text-neutral-900 dark:text-neutral-100"
		>{likeCount} like{likeCount != 1 ? 's' : ''}</span
	>
	{#if pb.authStore.isValid}
		<div class="relative">
			{#if showFloatingPlus}
				<span class="floating-plus absolute -top-7 left-1/2 text-sm font-bold text-neutral-900 dark:text-neutral-100">
					+1
				</span>
			{/if}
			<button
				on:click={toggleLike}
				class="rounded-lg bg-black p-2 px-4 font-medium text-neutral-100 hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
				class:popping
			>
				{isLiked ? 'Unlike' : 'Like'}
			</button>
		</div>
	{:else}
		<a
			href="/auth?goto={$page.url.pathname}"
			class="font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-100"
		>
			Log in to like
		</a>
	{/if}
</div>

<style>
	@keyframes pop {
		0%   { transform: scale(1); }
		40%  { transform: scale(1.18); }
		70%  { transform: scale(0.94); }
		100% { transform: scale(1); }
	}

	@keyframes float-up {
		0%   { opacity: 1; transform: translateX(-50%) translateY(0); }
		100% { opacity: 0; transform: translateX(-50%) translateY(-18px); }
	}

	.popping {
		animation: pop 0.38s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
	}

	.floating-plus {
		animation: float-up 0.65s ease-out forwards;
		pointer-events: none;
	}
</style>
