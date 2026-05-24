<script>
	import { page } from '$app/stores';
	import { onDestroy, onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { createWebHaptics } from 'web-haptics/svelte';
	import { useQuery } from 'convex-svelte';
	import { api } from '$convex/_generated/api';
	import CommentNode from './CommentNode.svelte';
	import { buildTree } from './buildTree.js';
	import { clientIpHash, hashReal, hashAttempted, resolveIpHash } from '$lib/ipHash.js';

	const MAX_LENGTH = 200;
	const CHAR_THRESHOLD = 10;

	const { trigger, destroy } = createWebHaptics();
	onDestroy(destroy);

	function haptic() {
		trigger([{ duration: 15 }], { intensity: 0.4 });
	}

	// Main comment form
	let commentText = $state('');
	let username = $state('');
	let password = $state('');
	let formSubmitted = $state(false);
	let submitting = $state(false);
	let submitError = $state('');

	// Generate a Linear-style anonymous handle for the placeholder
	// (e.g. "stranger-7sl", "wanderer-k2x"). Stable per session.
	const handleAdjectives = [
		'stranger',
		'wanderer',
		'visitor',
		'passerby',
		'guest',
		'reader',
		'cosmonaut',
		'rambler',
		'drifter',
		'lurker',
		'tinkerer',
		'pilgrim'
	];
	function makeHandle() {
		const adj = handleAdjectives[Math.floor(Math.random() * handleAdjectives.length)];
		const suffix = Math.random().toString(36).slice(2, 5);
		return `${adj}-${suffix}`;
	}
	const fallbackHandle = makeHandle();

	onMount(resolveIpHash);

	// Reactive comments query — live updates across tabs
	const query = useQuery(
		api.comments.list,
		() => ({
			url: $page.url.pathname,
			ipHash: $clientIpHash
		}),
		// The runtime ipHash re-subscription swaps the query args on every visit.
		// Keep the prior result so the comments don't flash back to loading.
		{ keepPreviousData: true }
	);

	// Cross-card form coordination — only one form open at a time
	let activeFormId = $state(null);
	function setActiveForm(id) {
		activeFormId = id;
	}

	// Vote in-flight tracking (per-comment, race-safe)
	const votingIds = new SvelteSet();
	let votingAnim = $state({ id: null, side: null });
	let votingAnimTimer = null;
	let voteError = $state('');
	let voteErrorTimer = null;

	function showVoteError(message) {
		voteError = message;
		if (voteErrorTimer) clearTimeout(voteErrorTimer);
		voteErrorTimer = setTimeout(() => (voteError = ''), 3000);
	}

	async function vote(commentId, voteType) {
		if (!canVote) return;
		if (votingIds.has(commentId)) return;

		if (votingAnimTimer) clearTimeout(votingAnimTimer);
		votingAnim = { id: commentId, side: voteType };
		votingAnimTimer = setTimeout(() => {
			votingAnim = { id: null, side: null };
			votingAnimTimer = null;
		}, 300);

		votingIds.add(commentId);
		try {
			const res = await fetch(`/api/comments/${commentId}/vote`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ voteType })
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				showVoteError(data.message ?? 'Could not register vote.');
			}
		} catch {
			showVoteError('Something went wrong.');
		} finally {
			votingIds.delete(commentId);
		}
	}

	const charsLeft = $derived(MAX_LENGTH - commentText.length);
	const showCharsLeft = $derived(commentText.length > MAX_LENGTH - CHAR_THRESHOLD);
	const isSubmitDisabled = $derived(
		submitting ||
			!commentText.trim() ||
			!password ||
			password.length < 4 ||
			commentText.length > MAX_LENGTH
	);

	const commentTree = $derived(buildTree(query.data ?? []));

	// `myVote` is per-visitor: trust the highlight only once the real hash is in
	// use and the subscription holds fresh (non-stale) data. Allow clicking once
	// trusted, or once a failed /api/ip-hash leaves us with fresh data and no
	// real hash (the vote itself is computed from the real IP server-side, so a
	// broken hash fetch must not lock voting forever).
	const voteKnown = $derived($hashReal && !query.isStale && !!query.data);
	const canVote = $derived(
		voteKnown || ($hashAttempted && !$hashReal && !query.isStale && !!query.data)
	);

	// Reset transient form state on path change
	let currentPath = $state($page.url.pathname);
	$effect(() => {
		if ($page.url.pathname !== currentPath) {
			currentPath = $page.url.pathname;
			commentText = '';
			username = '';
			password = '';
			formSubmitted = false;
			submitError = '';
			activeFormId = null;
		}
	});

	async function submitComment() {
		formSubmitted = true;
		submitError = '';
		if (!commentText.trim()) return;
		if (password.length < 4) return;
		if (commentText.length > MAX_LENGTH) return;

		submitting = true;
		try {
			const res = await fetch('/api/comments', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					url: $page.url.pathname,
					username: username.trim() || fallbackHandle,
					password,
					text: commentText.trim()
				})
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				submitError = data.message ?? data.error ?? 'Failed to submit comment.';
				return;
			}
			commentText = '';
			username = '';
			password = '';
			formSubmitted = false;
		} catch {
			submitError = 'Something went wrong. Please try again.';
		} finally {
			submitting = false;
		}
	}
</script>

<div>
	<h3 class="mb-4 text-2xl font-semibold tracking-tight" id="comments">Comments</h3>

	<!-- Main comment form -->
	<div class="mt-2 space-y-2">
		<input
			bind:value={username}
			type="text"
			aria-label="Name"
			placeholder={`Name (optional — defaults to ${fallbackHandle})`}
			maxlength="32"
			class="w-full rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-2 text-neutral-900 focus:ring-2 focus:ring-neutral-200 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:focus:ring-neutral-800"
		/>
		<div>
			<textarea
				bind:value={commentText}
				aria-label="Comment"
				placeholder="Say something… (max {MAX_LENGTH} characters)"
				maxlength={MAX_LENGTH}
				rows="3"
				class="w-full resize-none rounded-lg border border-neutral-300 bg-neutral-100 p-2 text-neutral-900 focus:ring-2 focus:ring-neutral-200 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:focus:ring-neutral-800"
			></textarea>
			{#if showCharsLeft}
				<p class="tabular mt-1 text-sm text-neutral-500">Characters left: {charsLeft}</p>
			{/if}
		</div>
		<div>
			<input
				bind:value={password}
				type="password"
				aria-label="Comment password"
				placeholder="Password (save this to edit your comment later)"
				autocomplete="off"
				class="w-full rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-2 text-neutral-900 focus:ring-2 focus:ring-neutral-200 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:focus:ring-neutral-800"
			/>
			{#if formSubmitted && password.length > 0 && password.length < 4}
				<p class="mt-1 text-sm text-red-500">Password must be at least 4 characters.</p>
			{/if}
		</div>
		{#if submitError}
			<p class="text-sm text-red-500">{submitError}</p>
		{/if}
		<button
			onclick={() => {
				haptic();
				submitComment();
			}}
			disabled={isSubmitDisabled}
			class="rounded-lg bg-neutral-900 p-2 px-4 font-medium text-white transition-[background-color,transform] duration-150 ease-out hover:bg-neutral-800 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
		>
			{submitting ? 'Submitting…' : 'Submit'}
		</button>
	</div>
</div>

{#if voteError}
	<p class="mt-4 text-sm text-red-500">{voteError}</p>
{/if}

<div class="mt-8">
	{#if query.isLoading}
		{#each [1, 2, 3] as skeleton (skeleton)}
			<div
				class="mb-4 rounded-xl border border-neutral-200 bg-neutral-100 p-4 dark:border-neutral-800 dark:bg-neutral-900"
			>
				<div class="shimmer mb-3 h-4 w-24 rounded"></div>
				<div class="shimmer h-3 w-full rounded"></div>
				<div class="shimmer mt-2 h-3 w-3/4 rounded"></div>
				<div class="shimmer mt-3 h-3 w-20 rounded"></div>
			</div>
		{/each}
	{:else if query.error != null}
		<div class="flex flex-col items-center gap-3 py-10 text-center">
			<p class="text-neutral-500 dark:text-neutral-400">Could not load comments.</p>
		</div>
	{:else if commentTree.length > 0}
		{#each commentTree as comment (comment.id)}
			<div class="mb-4">
				<CommentNode
					{comment}
					{activeFormId}
					{setActiveForm}
					{votingIds}
					{votingAnim}
					{canVote}
					{voteKnown}
					onVote={vote}
					onHaptic={haptic}
				/>
			</div>
		{/each}
	{:else}
		<p class="pt-10 text-center text-lg font-medium text-neutral-500 dark:text-neutral-500">
			No comments yet. Be the first to comment!
		</p>
	{/if}
</div>
