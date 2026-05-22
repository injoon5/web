<script>
	import { page } from '$app/stores';
	import { onDestroy } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { createWebHaptics } from 'web-haptics/svelte';
	import { useQuery } from 'convex-svelte';
	import { api } from '$convex/_generated/api';
	import CommentNode from './CommentNode.svelte';

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

	// Reactive comments query — live updates across tabs
	const query = useQuery(api.comments.list, () => ({
		url: $page.url.pathname,
		ipHash: $page.data.ipHash ?? ''
	}));

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

	// Build nested tree. Replies whose parent was hard-deleted are surfaced as
	// stray roots (rendered with an "orphaned reply" badge).
	function buildTree(flat) {
		const map = new Map();
		for (const c of flat) map.set(c.id, { ...c, children: [] });

		const roots = [];
		for (const node of map.values()) {
			if (node.parentId && map.has(node.parentId)) {
				map.get(node.parentId).children.push(node);
			} else if (!node.parentId) {
				roots.push(node);
			} else {
				roots.push({ ...node, stray: true });
			}
		}

		for (const node of map.values()) {
			node.children.sort((a, b) => a.createdAt - b.createdAt);
		}

		return roots;
	}

	const commentTree = $derived(buildTree(query.data ?? []));

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
					username: username.trim() || undefined,
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
			placeholder="Name (optional)"
			maxlength="32"
			class="w-full rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-2 text-neutral-900 focus:ring-2 focus:ring-neutral-200 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:focus:ring-neutral-800"
		/>
		<div>
			<textarea
				bind:value={commentText}
				placeholder="Show me what you got.. (max {MAX_LENGTH} characters)"
				maxlength={MAX_LENGTH}
				rows="3"
				class="w-full resize-none rounded-lg border border-neutral-300 bg-neutral-100 p-2 text-neutral-900 focus:ring-2 focus:ring-neutral-200 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:focus:ring-neutral-800"
			></textarea>
			{#if showCharsLeft}
				<p class="mt-1 text-sm text-neutral-500">Characters left: {charsLeft}</p>
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
			class="rounded-lg bg-neutral-900 p-2 px-4 font-medium text-white transition-all duration-150 hover:bg-neutral-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
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
		{#each [1, 2, 3] as _}
			<div
				class="mb-4 animate-pulse rounded-lg border border-neutral-200 bg-neutral-100 p-4 dark:border-neutral-800 dark:bg-neutral-900"
			>
				<div class="mb-3 h-4 w-24 rounded bg-neutral-300 dark:bg-neutral-700"></div>
				<div class="h-3 w-full rounded bg-neutral-200 dark:bg-neutral-800"></div>
				<div class="mt-2 h-3 w-3/4 rounded bg-neutral-200 dark:bg-neutral-800"></div>
				<div class="mt-3 h-3 w-20 rounded bg-neutral-200 dark:bg-neutral-800"></div>
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
