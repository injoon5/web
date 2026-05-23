<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import NumberFlow from '@number-flow/svelte';
	import { useQuery, useConvexClient } from 'convex-svelte';
	import { api } from '$convex/_generated/api';
	import Heart from '@lucide/svelte/icons/heart';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';

	// Pages are prerendered, so any ipHash baked in at build time never matches a
	// real visitor. We fetch the visitor's real hash at runtime; until that
	// resolves we must NOT trust the `liked` flag — the query would report
	// `liked: false` for a page the visitor has actually liked, and clicking the
	// button would then silently remove that like (the count drops).
	let clientIpHash = $state('');
	let hashReal = $state(false);
	let hashAttempted = $state(false);

	const client = useConvexClient();

	const query = useQuery(
		api.likes.get,
		() => ({
			url: $page.url.pathname,
			ipHash: clientIpHash
		}),
		// Keep the prior result so the count doesn't flash to the skeleton when
		// the ipHash re-subscription fires. `isStale` (below) tells us when the
		// retained data belongs to different args so we never treat data from a
		// previous page — or the pre-resolution hash — as authoritative.
		{ keepPreviousData: true }
	);

	onMount(async () => {
		try {
			const res = await fetch('/api/ip-hash');
			if (res.ok) {
				const data = await res.json();
				if (data.ipHash) {
					clientIpHash = data.ipHash;
					hashReal = true;
				}
			}
		} catch {
			// keep the empty hash; liked state stays unknown
		} finally {
			hashAttempted = true;
		}
	});

	let toggling = $state(false);
	let likeError = $state('');
	let likeErrorTimer = null;
	let particles = $state([]);
	let particleId = 0;

	// Pathname of the most recent fresh (non-stale) result, so we can tell
	// whether retained stale data still applies to the current page (an ipHash
	// swap on the same URL) or belongs to a post we navigated away from.
	let dataUrl = $state(null);
	$effect(() => {
		if (query.data && !query.isStale) dataUrl = $page.url.pathname;
	});

	const path = $derived($page.url.pathname);
	// The count is independent of the visitor's hash, so retained same-URL data
	// is still correct; only data carried over from another URL must be hidden.
	const countApplies = $derived(!query.isStale || dataUrl === path);
	// `liked` is per-visitor: trust it only once the real hash is in use and the
	// subscription holds fresh data for the current page.
	const likedReady = $derived(hashReal && !query.isStale && !!query.data && dataUrl === path);

	const likeCount = $derived(countApplies ? (query.data?.count ?? 0) : 0);
	const isLiked = $derived(likedReady ? query.data.liked : false);
	const showCount = $derived(countApplies && !!query.data);
	// The toggle now runs client-side and is keyed by clientIpHash, so we can only
	// like once the real hash has resolved — otherwise we'd write a like under the
	// empty hash. Allow clicks only when the liked state is trustworthy.
	const interactive = $derived(likedReady);
	const busy = $derived(!interactive || toggling);
	// Spinner while we're still resolving identity/data. After a failed hash fetch
	// we stop spinning and leave the button disabled (the count still shows).
	const resolving = $derived(!hashAttempted || (hashReal && !likedReady));

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

	function errorMessage(err) {
		const data = err && typeof err === 'object' ? err.data : undefined;
		if (data && typeof data === 'object') {
			if (data.kind === 'Banned') return 'You have been banned.';
			if (data.kind === 'RateLimited') return 'Too many requests. Please slow down.';
			if (typeof data.message === 'string') return data.message;
		}
		return 'Could not save like.';
	}

	async function toggleLike() {
		if (busy) return;
		if (isLiked === false) spawnHearts();
		toggling = true;
		likeError = '';
		try {
			// The toggle runs through the Convex client (not the HTTP route) so the
			// optimistic update can flip the cached `get` result instantly; Convex
			// reconciles with the real result and rolls back automatically on error.
			await client.mutation(
				api.likes.toggle,
				{ url: $page.url.pathname, ipHash: clientIpHash },
				{
					optimisticUpdate: (localStore, args) => {
						const current = localStore.getQuery(api.likes.get, {
							url: args.url,
							ipHash: args.ipHash
						});
						if (current === undefined) return;
						const liked = !current.liked;
						localStore.setQuery(
							api.likes.get,
							{ url: args.url, ipHash: args.ipHash },
							{ count: current.count + (liked ? 1 : -1), liked }
						);
					}
				}
			);
		} catch (err) {
			showLikeError(errorMessage(err));
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
			onclick={toggleLike}
			disabled={busy}
			aria-pressed={isLiked}
			class="inline-flex items-center justify-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-[background-color,border-color,color,transform] duration-200 ease-out active:scale-[0.94] disabled:cursor-not-allowed disabled:opacity-60
			{isLiked
				? 'border-rose-300/70 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/60'
				: 'border-neutral-200 bg-transparent text-neutral-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 dark:border-neutral-800 dark:text-neutral-300 dark:hover:border-rose-900/50 dark:hover:bg-rose-950/30 dark:hover:text-rose-300'}"
		>
			{#if resolving}
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
