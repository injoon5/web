<script>
	import { page } from '$app/stores';
	import NumberFlow from '@number-flow/svelte';
	import { useQuery } from 'convex-svelte';
	import { api } from '$convex/_generated/api';
	import Heart from '@lucide/svelte/icons/heart';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';

	const ipHash = $derived($page.data.ipHash ?? '');

	const query = useQuery(
		api.likes.get,
		() => ({
			url: $page.url.pathname,
			ipHash
		}),
		// Keep the prior result so the count doesn't flash to the skeleton when
		// the ipHash re-subscription fires. `isStale` (below) tells us when the
		// retained data belongs to different args so we never treat data from a
		// previous page — or the pre-resolution hash — as authoritative.
		{ keepPreviousData: true }
	);

	let toggling = $state(false);
	let likeError = $state('');
	let likeErrorTimer = null;
	let particles = $state([]);
	let particleId = 0;
	let mutationResult = $state(null);

	// Pathname of the most recent fresh (non-stale) result, so we can tell
	// whether retained stale data still applies to the current page (an ipHash
	// swap on the same URL) or belongs to a post we navigated away from.
	let dataUrl = $state(null);
	$effect(() => {
		if (query.data && !query.isStale) dataUrl = $page.url.pathname;
	});

	const path = $derived($page.url.pathname);
	const freshQueryForPath = $derived(!query.isStale && !!query.data && dataUrl === path);
	$effect(() => {
		if (!mutationResult) return;
		if (
			mutationResult.url !== path ||
			(freshQueryForPath && query.data.liked === mutationResult.liked)
		) {
			mutationResult = null;
		}
	});
	// The count is independent of the visitor's hash, so retained same-URL data
	// is still correct; only data carried over from another URL must be hidden.
	const countApplies = $derived(!query.isStale || dataUrl === path);
	// `liked` is per-visitor: trust it once the subscription is fresh for this page.
	const likedReady = $derived(freshQueryForPath && !!ipHash);

	const currentMutationResult = $derived(mutationResult?.url === path ? mutationResult : null);
	const likeCount = $derived(
		currentMutationResult
			? currentMutationResult.count
			: countApplies
				? (query.data?.count ?? 0)
				: 0
	);
	const isLiked = $derived(
		currentMutationResult ? currentMutationResult.liked : likedReady ? query.data.liked : false
	);
	const showCount = $derived(!!currentMutationResult || (countApplies && !!query.data));
	const interactive = $derived(countApplies && likedReady);
	const busy = $derived(!interactive || toggling);

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
				mutationResult = {
					url: $page.url.pathname,
					count: data.count,
					liked: data.liked
				};
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
	{#if !showCount}
		<span class="shimmer mr-2 inline-block h-6 w-16 rounded"></span>
	{:else}
		<span
			class="tabular mr-2 inline-flex items-baseline text-lg text-neutral-900 dark:text-neutral-100"
		>
			<NumberFlow value={likeCount} trend={0} />
			<span class="ml-1">like{likeCount !== 1 ? 's' : ''}</span>
		</span>
	{/if}

	<div class="relative">
		<!-- Heart confetti particles -->
		{#each particles as p (p.id)}
			<span
				class="heart-particle pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-rose-500 select-none"
				style="--tx: {p.tx}px; --ty: {p.ty}px; --r: {p.rotate}deg; --s: {p.scale}; animation-delay: {p.delay}ms;"
				aria-hidden="true"
			>
				<Heart size="14" fill="currentColor" strokeWidth="0" />
			</span>
		{/each}

		<button
			onclick={toggleLike}
			disabled={busy}
			aria-pressed={isLiked}
			/* 
			   transition-[background-color,border-color,color,transform,width] enables width, see next line
			   ease-out and duration-200 for animation
			   will-change-[width,background-color,border-color,color,transform] for hinting 
			*/
			class="inline-flex items-center justify-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-[background-color,border-color,color,transform,width] duration-200 ease-out will-change-[width,background-color,border-color,color,transform] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-60
			{isLiked
				? 'border-rose-300/70 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/60'
				: 'border-neutral-200 bg-transparent text-neutral-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 dark:border-neutral-800 dark:text-neutral-300 dark:hover:border-rose-900/50 dark:hover:bg-rose-950/30 dark:hover:text-rose-300'}"
		>
			{#if busy}
				<LoaderCircle size="14" strokeWidth="2" class="animate-spin" aria-hidden="true" />
			{:else}
				<Heart
					size="14"
					strokeWidth="2"
					fill={isLiked ? 'currentColor' : 'none'}
					aria-hidden="true"
				/>
			{/if}
			<span
				class="like-label inline-block whitespace-nowrap transition-[width] duration-200 ease-out will-change-[width]"
				style="width: {isLiked ? '40px' : '30px'}"
			>
				{isLiked ? 'Liked' : 'Like'}
			</span>
		</button>
	</div>
</div>
{#if likeError}
	<p class="mt-2 text-sm text-red-500">{likeError}</p>
{/if}
