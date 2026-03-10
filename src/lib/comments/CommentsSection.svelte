<script lang="ts">
	import { page } from '$app/stores';
	import { onMount, onDestroy } from 'svelte';
	import { createWebHaptics } from 'web-haptics/svelte';
	import CommentCard from './CommentCard.svelte';

	const { trigger, destroy } = createWebHaptics();
	onDestroy(destroy);

	// Main comment form
	let commentText = '';
	let username = '';
	let password = '';
	let formSubmitted = false;
	let submitting = false;
	let submitError = '';

	// Comments list
	let comments: any[] = [];
	let currentPath = '';
	let commentsLoading = true;
	let commentsError = false;

	// Edit state (shared singleton — only one comment editable at a time)
	let editingId: string | null = null;
	let editText = '';
	let editPassword = '';
	let editError = '';
	let editSubmitting = false;

	// Vote state
	let votingId: string | null = null;
	let votingAnimId: string | null = null;
	let votingSide: string | null = null;
	let voteError = '';
	let voteErrorTimer: ReturnType<typeof setTimeout> | null = null;

	// Reply state (shared singleton — only one reply form at a time)
	let replyingToId: string | null = null;
	let replyText = '';
	let replyUsername = '';
	let replyPassword = '';
	let replySubmitting = false;
	let replyError = '';

	const MAX_LENGTH = 200;
	const CHAR_THRESHOLD = 10;

	$: charsLeft = MAX_LENGTH - commentText.length;
	$: showCharsLeft = commentText.length > MAX_LENGTH - CHAR_THRESHOLD;
	$: isSubmitDisabled =
		submitting ||
		!commentText.trim() ||
		!password ||
		password.length < 4 ||
		commentText.length > MAX_LENGTH;

	// Build a nested comment tree from the flat API response.
	// Root comments retain server order (score desc). Children are sorted chronologically.
	function buildTree(flat: any[]): any[] {
		const map = new Map<string, any>();
		for (const c of flat) map.set(c.id, { ...c, children: [] });

		const roots: any[] = [];
		for (const node of map.values()) {
			if (node.parentId && map.has(node.parentId)) {
				map.get(node.parentId).children.push(node);
			} else if (!node.parentId) {
				roots.push(node);
			}
			// Replies whose parent was deleted are silently dropped
		}

		for (const node of map.values()) {
			node.children.sort(
				(a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
			);
		}

		return roots;
	}

	$: commentTree = buildTree(comments);

	onMount(() => {
		currentPath = $page.url.pathname;
		loadComments();
	});

	$: if ($page.url.pathname !== currentPath && currentPath) {
		currentPath = $page.url.pathname;
		commentText = '';
		username = '';
		password = '';
		formSubmitted = false;
		submitError = '';
		comments = [];
		commentsLoading = true;
		commentsError = false;
		editingId = null;
		votingId = null;
		replyingToId = null;
		loadComments();
	}

	async function loadComments() {
		commentsLoading = true;
		commentsError = false;
		try {
			const res = await fetch(`/api/comments?url=${encodeURIComponent($page.url.pathname)}`);
			if (res.ok) {
				const data = await res.json();
				comments = data.comments;
			} else {
				commentsError = true;
			}
		} catch {
			commentsError = true;
		} finally {
			commentsLoading = false;
		}
	}

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
			const data = await res.json();
			if (!res.ok) {
				submitError = data.message ?? 'Failed to submit comment.';
				return;
			}
			commentText = '';
			username = '';
			password = '';
			formSubmitted = false;
			await loadComments();
		} catch {
			submitError = 'Something went wrong. Please try again.';
		} finally {
			submitting = false;
		}
	}

	function showVoteError(message: string) {
		voteError = message;
		if (voteErrorTimer) clearTimeout(voteErrorTimer);
		voteErrorTimer = setTimeout(() => {
			voteError = '';
		}, 3000);
	}

	async function vote(commentId: string, voteType: string) {
		if (votingId === commentId) return;
		trigger([{ duration: 15 }], { intensity: 0.4 });

		votingAnimId = commentId;
		votingSide = voteType;
		setTimeout(() => {
			votingAnimId = null;
			votingSide = null;
		}, 300);

		votingId = commentId;
		try {
			const res = await fetch(`/api/comments/${commentId}/vote`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ voteType })
			});
			if (res.ok) {
				const data = await res.json();
				comments = comments.map((c) =>
					c.id === commentId
						? {
								...c,
								upvotes: data.upvotes,
								downvotes: data.downvotes,
								score: data.upvotes - data.downvotes,
								myVote: data.myVote
							}
						: c
				);
			} else {
				const data = await res.json().catch(() => ({}));
				showVoteError(data.message ?? 'Could not register vote.');
			}
		} catch {
			showVoteError('Something went wrong.');
		} finally {
			votingId = null;
		}
	}

	function startEdit(comment: any) {
		editingId = comment.id;
		editText = comment.text;
		editPassword = '';
		editError = '';
		replyingToId = null;
	}

	function cancelEdit() {
		editingId = null;
		editText = '';
		editPassword = '';
		editError = '';
	}

	async function saveEdit(commentId: string) {
		editError = '';
		if (!editText.trim()) {
			editError = 'Comment cannot be empty.';
			return;
		}
		if (editText.length > MAX_LENGTH) {
			editError = `Max ${MAX_LENGTH} characters.`;
			return;
		}
		if (!editPassword) {
			editError = 'Password is required.';
			return;
		}

		editSubmitting = true;
		try {
			const res = await fetch(`/api/comments/${commentId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text: editText.trim(), password: editPassword })
			});
			const data = await res.json();
			if (!res.ok) {
				editError = data.message ?? 'Failed to save.';
				return;
			}
			comments = comments.map((c) =>
				c.id === commentId
					? { ...c, text: data.comment.text, updatedAt: data.comment.updatedAt }
					: c
			);
			cancelEdit();
		} catch {
			editError = 'Something went wrong.';
		} finally {
			editSubmitting = false;
		}
	}

	function startReply(comment: any) {
		trigger([{ duration: 15 }], { intensity: 0.4 });
		replyingToId = comment.id;
		replyText = '';
		replyUsername = '';
		replyPassword = '';
		replyError = '';
		editingId = null;
	}

	function cancelReply() {
		replyingToId = null;
		replyText = '';
		replyUsername = '';
		replyPassword = '';
		replyError = '';
	}

	async function submitReply() {
		replyError = '';
		if (!replyText.trim()) {
			replyError = 'Reply cannot be empty.';
			return;
		}
		if (replyPassword.length < 4) {
			replyError = 'Password must be at least 4 characters.';
			return;
		}
		if (replyText.length > MAX_LENGTH) {
			replyError = `Max ${MAX_LENGTH} characters.`;
			return;
		}

		replySubmitting = true;
		try {
			const res = await fetch('/api/comments', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					url: $page.url.pathname,
					username: replyUsername.trim() || undefined,
					password: replyPassword,
					text: replyText.trim(),
					parentId: replyingToId
				})
			});
			const data = await res.json();
			if (!res.ok) {
				replyError = data.message ?? 'Failed to submit reply.';
				return;
			}
			cancelReply();
			await loadComments();
		} catch {
			replyError = 'Something went wrong. Please try again.';
		} finally {
			replySubmitting = false;
		}
	}

	// Shared props passed to every CommentCard
	$: cardProps = {
		editingId,
		editText,
		editPassword,
		editError,
		editSubmitting,
		votingId,
		votingAnimId,
		votingSide,
		replyingToId,
		replyText,
		replyUsername,
		replyPassword,
		replyError,
		replySubmitting,
		MAX_LENGTH,
		onVote: vote,
		onStartEdit: startEdit,
		onCancelEdit: cancelEdit,
		onSaveEdit: saveEdit,
		onStartReply: startReply,
		onCancelReply: cancelReply,
		onSubmitReply: submitReply
	};
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
			class="w-full rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-2 text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:focus:ring-neutral-800"
		/>
		<div>
			<textarea
				bind:value={commentText}
				placeholder="Show me what you got.. (max {MAX_LENGTH} characters)"
				maxlength={MAX_LENGTH}
				rows="3"
				class="w-full resize-none rounded-lg border border-neutral-300 bg-neutral-100 p-2 text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:focus:ring-neutral-800"
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
				class="w-full rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-2 text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:focus:ring-neutral-800"
			/>
			{#if formSubmitted && password.length > 0 && password.length < 4}
				<p class="mt-1 text-sm text-red-500">Password must be at least 4 characters.</p>
			{/if}
		</div>
		{#if submitError}
			<p class="text-sm text-red-500">{submitError}</p>
		{/if}
		<button
			on:click={() => {
				trigger([{ duration: 15 }], { intensity: 0.4 });
				submitComment();
			}}
			disabled={isSubmitDisabled}
			class="rounded-lg bg-neutral-900 p-2 px-4 font-medium text-white transition-all duration-150 hover:bg-neutral-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
		>
			{submitting ? 'Submitting…' : 'Submit'}
		</button>
	</div>
</div>

<!-- Vote error toast -->
{#if voteError}
	<p class="mt-4 text-sm text-red-500">{voteError}</p>
{/if}

<!-- Comment list -->
<div class="mt-8">
	{#if commentsLoading}
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
	{:else if commentsError}
		<div class="flex flex-col items-center gap-3 py-10 text-center">
			<p class="text-neutral-500 dark:text-neutral-400">Could not load comments.</p>
			<button
				on:click={loadComments}
				class="rounded-lg border border-neutral-300 px-4 py-1.5 text-sm font-medium text-neutral-600 transition-all duration-150 hover:bg-neutral-100 active:scale-95 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
			>
				Retry
			</button>
		</div>
	{:else if commentTree.length > 0}
		{#each commentTree as comment (comment.id)}
			<div class="mb-4">
				<!-- Depth 0 -->
				<CommentCard
					{comment}
					bind:editText
					bind:editPassword
					bind:replyText
					bind:replyUsername
					bind:replyPassword
					{...cardProps}
				/>

				<!-- Depth 1 replies -->
				{#if comment.children.length > 0}
					<div
						class="mt-2 ml-4 space-y-2 border-l-2 border-neutral-200 pl-4 dark:border-neutral-700"
					>
						{#each comment.children as reply (reply.id)}
							<CommentCard
								comment={reply}
								bind:editText
								bind:editPassword
								bind:replyText
								bind:replyUsername
								bind:replyPassword
								{...cardProps}
							/>

							<!-- Depth 2 replies -->
							{#if reply.children.length > 0}
								<div
									class="ml-4 space-y-2 border-l-2 border-neutral-200/70 pl-4 dark:border-neutral-700/70"
								>
									{#each reply.children as subreply (subreply.id)}
										<CommentCard
											comment={subreply}
											bind:editText
											bind:editPassword
											bind:replyText
											bind:replyUsername
											bind:replyPassword
											{...cardProps}
										/>
									{/each}
								</div>
							{/if}
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	{:else}
		<p class="pt-10 text-center text-lg font-medium text-neutral-500 dark:text-neutral-500">
			No comments yet. Be the first to comment!
		</p>
	{/if}
</div>
