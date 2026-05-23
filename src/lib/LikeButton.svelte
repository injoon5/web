<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import NumberFlow from '@number-flow/svelte';
	import { useQuery } from 'convex-svelte';
	import { api } from '$convex/_generated/api';
	import Heart from '@lucide/svelte/icons/heart';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';

	// Pages are prerendered, so the layout's ipHash is frozen at build time and
	// never matches a real visitor — the liked state would always read false.
	// Fetch the visitor's real hash at runtime and re-subscribe with it.
	let clientIpHash = $state($page.data.ipHash ?? '');

	const query = useQuery(
		api.likes.get,
		() => ({
			url: $page.url.pathname,
			ipHash: clientIpHash
		}),
		// The runtime ipHash re-subscription (see onMount) swaps the query args
		// on every visit. Keep the prior result so the count doesn't flash back
		// to the loading skeleton each load.
		{ keepPreviousData: true }
	);

	onMount(async () => {
		try {
			const res = await fetch('/api/ip-hash');
			if (res.ok) {
				const data = await res.json();
				if (data.ipHash) clientIpHash = data.ipHash;
			}
		} catch {
			// keep the fallback hash
		}
	});

	let toggling = $state(false);
	let likeError = $state('');
	let likeErrorTimer = null;
	let particles = $state([]);
	let particleId = 0;
	let buttonEl;

	const likeCount = $derived(query.data?.count ?? 0);
	const isLiked = $derived(query.data?.liked ?? false);
	const loading = $derived(query.isLoading);

	function showLikeError(message) {
		likeError = message;
		if (likeErrorTimer) clearTimeout(likeErrorTimer);
		likeErrorTimer = setTimeout(() => {
			likeError = '';
		}, 3000);
	}

	function spawnHearts() {
		const count = 10;
		const batch = Array.from({ length: count }, (_, i) => {
			const angle = (360 / count) * i + (Math.random() * 24 - 12);
			const distance = 38 + Math.random() * 36;
			const rad = ((angle - 90) * Math.PI) / 180;
			return {
				id: particleId++,
				tx: Math.cos(rad) * distance,
				ty: Math.sin(rad) * distance,
				rotate: Math.random() * 50 - 25,
				scale: 0.7 + Math.random() * 0.6,
				delay: Math.floor(Math.random() * 100)
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
				if (data.liked) spawnHearts();
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
		<span class="shimmer mr-2 inline-block h-6 w-16 rounded"></span>
	{:else}
		<span
			class="mr-2 inline-flex items-baseline text-lg text-neutral-900 dark:text-neutral-100 tabular"
		>
			<NumberFlow value={likeCount} trend={0} />
			<span class="ml-1">like{likeCount !== 1 ? 's' : ''}</span>
		</span>
	{/if}

	<div class="relative">
		<!-- Heart confetti particles -->
		{#each particles as p (p.id)}
			<span
				class="heart-particle pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 select-none text-rose-500"
				style="--tx: {p.tx}px; --ty: {p.ty}px; --r: {p.rotate}deg; --s: {p.scale}; animation-delay: {p.delay}ms;"
				aria-hidden="true"
			>
				<Heart size="14" fill="currentColor" strokeWidth="0" />
			</span>
		{/each}

		<button
			bind:this={buttonEl}
			onclick={toggleLike}
			disabled={loading || toggling}
			aria-pressed={isLiked}
			class="inline-flex items-center justify-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-[background-color,border-color,color,transform] duration-200 ease-out active:scale-[0.94] disabled:cursor-not-allowed disabled:opacity-60
			{isLiked
				? 'border-rose-300/70 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/60'
				: 'border-neutral-200 bg-transparent text-neutral-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 dark:border-neutral-800 dark:text-neutral-300 dark:hover:border-rose-900/50 dark:hover:bg-rose-950/30 dark:hover:text-rose-300'}"
		>
			{#if toggling}
				<LoaderCircle size="14" strokeWidth="2" class="animate-spin" aria-hidden="true" />
			{:else}
				<Heart
					size="14"
					strokeWidth="2"
					fill={isLiked ? 'currentColor' : 'none'}
					aria-hidden="true"
				/>
			{/if}
			<span class="like-label">
				{isLiked ? 'Liked' : 'Like'}
			</span>
		</button>
	</div>
</div>
{#if likeError}
	<p class="mt-2 text-sm text-red-500">{likeError}</p>
{/if}

<style>
	.like-label {
		display: inline-block;
		white-space: nowrap;
	}
</style>
