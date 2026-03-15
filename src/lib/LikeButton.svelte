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
	let particles = [];
	let particleId = 0;

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

	function spawnHearts() {
		const count = 10;
		const batch = Array.from({ length: count }, (_, i) => {
			// Spread hearts in all directions, biased slightly upward
			const angle = (360 / count) * i + (Math.random() * 24 - 12);
			const distance = 38 + Math.random() * 36;
			const rad = ((angle - 90) * Math.PI) / 180; // -90 so 0° is up
			return {
				id: particleId++,
				tx: Math.cos(rad) * distance,
				ty: Math.sin(rad) * distance,
				rotate: Math.random() * 50 - 25,
				scale: 0.7 + Math.random() * 0.6,
				delay: Math.floor(Math.random() * 60)
			};
		});
		particles = [...particles, ...batch];
		setTimeout(() => {
			const ids = new Set(batch.map((p) => p.id));
			particles = particles.filter((p) => !ids.has(p.id));
		}, 900);
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
				if (isLiked) spawnHearts();
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

	<div class="relative">
		<!-- Heart confetti particles -->
		{#each particles as p (p.id)}
			<span
				class="heart-particle pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none text-rose-500"
				style="--tx: {p.tx}px; --ty: {p.ty}px; --r: {p.rotate}deg; --s: {p.scale}; animation-delay: {p.delay}ms;"
				aria-hidden="true"
			>❤</span>
		{/each}

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
</div>
{#if likeError}
	<p class="mt-2 text-sm text-red-500">{likeError}</p>
{/if}
