<script>
	import { page } from '$app/stores';
	import { onDestroy } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { createWebHaptics } from 'web-haptics/svelte';
	import { useQuery } from 'convex-svelte';
	import { api } from '$convex/_generated/api';
	import CommentNode from './CommentNode.svelte';
	import { buildTree } from './buildTree.js';
	import { MAX_COMMENT_LENGTH, CHAR_THRESHOLD, MIN_PASSWORD_LENGTH } from './constants.js';
	import { apiFetch } from '$lib/api-client.js';

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

	const ipHash = $derived($page.data.ipHash ?? '');
	const path = $derived($page.url.pathname);

	// Reactive comments query — live updates across tabs
	const query = useQuery(
		api.comments.list,
		() => ({
			url: path,
			ipHash
		}),
		// The runtime ipHash re-subscription swaps the query args on every visit.
		// Keep the prior result so the comments don't flash back to loading.
		// `freshPath` (below) tracks which page the latest non-stale result belongs
		// to, so retained data from a previous page is never treated as authoritative.
		{ keepPreviousData: true }
	);

	// Pathname the most recent fresh (non-stale) result belongs to.
	let freshPath = $state(null);
	$effect(() => {
		if (query.data && !query.isStale) freshPath = path;
	});
	const listReady = $derived(!query.isStale && !!query.data && freshPath === path);

	// Cross-card form coordination — only one form open at a time
	let activeFormId = $state(null);
	function setActiveForm(id) {
		activeFormId = id;
	}

	// One in-flight vote per comment; extra clicks are queued (not dropped).
	const votingIds = new SvelteSet();
	/** @type {Map<string, Promise<void>>} */
	const voteQueues = new Map();
	let votingAnim = $state({ id: null, side: null });
	let votingAnimTimer = null;
	let voteError = $state('');
	let voteErrorTimer = null;

	onDestroy(() => {
		if (votingAnimTimer) clearTimeout(votingAnimTimer);
		if (voteErrorTimer) clearTimeout(voteErrorTimer);
	});

	function showVoteError(message) {
		voteError = message;
		if (voteErrorTimer) clearTimeout(voteErrorTimer);
		voteErrorTimer = setTimeout(() => (voteError = ''), 3000);
	}

	async function performVote(commentId, voteType) {
		votingIds.add(commentId);
		const res = await apiFetch(`/api/comments/${commentId}/vote`, {
			method: 'POST',
			body: { voteType }
		});
		if (!res.ok) {
			showVoteError(
				res.message ?? (res.networkError ? 'Something went wrong.' : 'Could not register vote.')
			);
		}
		votingIds.delete(commentId);
	}

	function vote(commentId, voteType) {
		if (!canVote) return;

		if (votingAnimTimer) clearTimeout(votingAnimTimer);
		votingAnim = { id: commentId, side: voteType };
		votingAnimTimer = setTimeout(() => {
			votingAnim = { id: null, side: null };
			votingAnimTimer = null;
		}, 300);

		const prev = voteQueues.get(commentId) ?? Promise.resolve();
		const next = prev.then(() => performVote(commentId, voteType));
		voteQueues.set(commentId, next);
		next.finally(() => {
			if (voteQueues.get(commentId) === next) voteQueues.delete(commentId);
		});
	}

	const charsLeft = $derived(MAX_COMMENT_LENGTH - commentText.length);
	const showCharsLeft = $derived(commentText.length > MAX_COMMENT_LENGTH - CHAR_THRESHOLD);
	const isSubmitDisabled = $derived(
		submitting ||
			!commentText.trim() ||
			!password ||
			password.length < MIN_PASSWORD_LENGTH ||
			commentText.length > MAX_COMMENT_LENGTH
	);

	const commentTree = $derived(listReady ? buildTree(query.data) : []);

	// Trust per-visitor vote state once ipHash is loaded and the list is for this page.
	const voteKnown = $derived(listReady && !!ipHash);
	const canVote = $derived(voteKnown);

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
		if (password.length < MIN_PASSWORD_LENGTH) return;
		if (commentText.length > MAX_COMMENT_LENGTH) return;

		submitting = true;
		const res = await apiFetch('/api/comments', {
			method: 'POST',
			body: {
				url: $page.url.pathname,
				username: username.trim() || fallbackHandle,
				password,
				text: commentText.trim()
			}
		});
		submitting = false;
		if (!res.ok) {
			submitError =
				res.message ??
				(res.networkError
					? 'Something went wrong. Please try again.'
					: 'Failed to submit comment.');
			return;
		}
		commentText = '';
		username = '';
		password = '';
		formSubmitted = false;
	}
</script>

<div>
	<h3 class="mb-4 text-2xl font-semibold tracking-tight" id="comments">Comments</h3>

	<!-- Main comment form -->
	<div class="mt-2 space-y-2">
		<input
			bind:value={username}
			type="text"
			placeholder={`Name (optional — defaults to ${fallbackHandle})`}
			maxlength="32"
			class="w-full rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-2 text-neutral-900 focus:ring-2 focus:ring-neutral-200 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:focus:ring-neutral-800"
		/>
		<div>
			<textarea
				bind:value={commentText}
				placeholder="Say something… (max {MAX_COMMENT_LENGTH} characters)"
				maxlength={MAX_COMMENT_LENGTH}
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
				placeholder="Password (save this to edit your comment later)"
				autocomplete="off"
				class="w-full rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-2 text-neutral-900 focus:ring-2 focus:ring-neutral-200 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:focus:ring-neutral-800"
			/>
			{#if formSubmitted && password.length > 0 && password.length < MIN_PASSWORD_LENGTH}
				<p class="mt-1 text-sm text-red-500">
					Password must be at least {MIN_PASSWORD_LENGTH} characters.
				</p>
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
			class="rounded-lg bg-neutral-900 p-2 px-4 font-medium text-white transition-[background-color,transform] duration-150 ease-out hover:bg-neutral-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
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
