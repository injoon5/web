<script>
	import { page } from '$app/stores';
	import { onDestroy } from 'svelte';
	import NumberFlow from '@number-flow/svelte';
	import { useQuery } from 'convex-svelte';
	import { api } from '$convex/_generated/api';
	import Heart from '@lucide/svelte/icons/heart';

	const ipHash = $derived($page.data.ipHash ?? '');
	const path = $derived($page.url.pathname);

	const query = useQuery(
		api.likes.get,
		() => ({
			url: path,
			ipHash
		}),
		// Keep the prior result so the count doesn't flash to the skeleton when
		// the subscription re-fires. `freshPath` (below) tracks which page the
		// latest non-stale result belongs to, so retained data from a previous
		// page is never treated as authoritative.
		{ keepPreviousData: true }
	);

	// Pathname the most recent fresh (non-stale) result belongs to.
	let freshPath = $state(null);
	$effect(() => {
		if (query.data && !query.isStale) freshPath = path;
	});
	const ready = $derived(!query.isStale && !!query.data && freshPath === path);

	// Authoritative server state for this page (count is global; liked is per-IP).
	const serverCount = $derived(ready ? (query.data.count ?? 0) : 0);
	const serverLiked = $derived(ready && !!ipHash ? !!query.data.liked : false);

	// Optimistic intent: the liked state the user picked but the server hasn't
	// confirmed yet. `null` means "no pending intent, trust the server".
	let desired = $state(null);
	let pendingPath = $state(null);
	let inFlight = $state(false);
	// The intent value most recently persisted to the server. Lets the sync loop
	// tell "synced, waiting for realtime" apart from "still needs to be sent".
	let lastSent = null;
	let likeError = $state('');
	let likeErrorTimer = null;
	let particles = $state([]);
	let particleId = 0;

	onDestroy(() => {
		if (likeErrorTimer) clearTimeout(likeErrorTimer);
	});

	// New page: abandon any intent from the previous page and trust its server
	// state. An in-flight request for the old page still completes (and persists),
	// it just no longer touches this page's UI.
	let trackedPath = null;
	$effect(() => {
		if (path !== trackedPath) {
			trackedPath = path;
			desired = null;
			pendingPath = null;
			lastSent = null;
		}
	});

	// Drop the optimistic override only once nothing is in flight AND realtime
	// reflects our latest intent, so the button can never settle out of sync.
	$effect(() => {
		if (desired !== null && pendingPath === path && !inFlight && ready && serverLiked === desired) {
			desired = null;
			pendingPath = null;
			lastSent = null;
		}
	});

	const activePending = $derived(desired !== null && pendingPath === path ? desired : null);
	const isLiked = $derived(activePending !== null ? activePending : serverLiked);
	// Adjust the global count by our own optimistic delta only; other visitors'
	// likes already flow through `serverCount`.
	const likeCount = $derived(serverCount + ((isLiked ? 1 : 0) - (serverLiked ? 1 : 0)));
	const showCount = $derived(ready || activePending !== null);
	const interactive = $derived(ready && !!ipHash);

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

	function toggleLike() {
		if (!interactive) return;
		const next = !isLiked;
		desired = next;
		pendingPath = path;
		if (next) spawnHearts();
		sync();
	}

	// Persist the user's latest intent. One request in flight at a time; after each
	// send the loop re-reads `desired`, so the final state always reaches the server
	// (setLike is idempotent, so overlapping clicks converge instead of fighting).
	// On failure the optimistic state reverts and an error is shown, so the button
	// can never settle in a state different from the server.
	async function sync() {
		if (inFlight) return;
		inFlight = true;
		try {
			while (desired !== null && desired !== lastSent && pendingPath === path) {
				const sending = desired;
				const targetPath = path;
				let res = null;
				let threw = false;
				try {
					res = await fetch('/api/likes', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ url: targetPath, liked: sending })
					});
				} catch {
					threw = true;
				}

				// Navigated away mid-request: the write for the old page was already
				// sent, so stop — this page starts from its own server state.
				if (path !== targetPath) break;

				if (threw) {
					revert('Something went wrong.');
					break;
				}
				if (!res.ok) {
					const data = await res.json().catch(() => ({}));
					revert(data.message ?? 'Could not save like.');
					break;
				}
				lastSent = sending;
			}
		} finally {
			inFlight = false;
		}

		// A newer intent may have arrived while the lock was held (e.g. a click that
		// landed during navigation). Drive it now that we have released the lock.
		if (desired !== null && desired !== lastSent && pendingPath === path) {
			sync();
		}
	}

	function revert(message) {
		desired = null;
		pendingPath = null;
		lastSent = null;
		showLikeError(message);
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
			disabled={!interactive}
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
			<Heart
				size="14"
				strokeWidth="2"
				fill={isLiked ? 'currentColor' : 'none'}
				aria-hidden="true"
			/>
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
