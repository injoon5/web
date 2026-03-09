<script>
	import { page } from '$app/stores';
	import { onMount, onDestroy } from 'svelte';
	import { createWebHaptics } from 'web-haptics/svelte';

	const { trigger, destroy } = createWebHaptics();
	onDestroy(destroy);

	// Form state
	let commentText = '';
	let username = '';
	let password = '';
	let formSubmitted = false;
	let submitting = false;
	let submitError = '';

	// Comments
	let comments = [];
	let currentPath = '';

	// Edit state
	let editingId = null;
	let editText = '';
	let editPassword = '';
	let editError = '';
	let editSubmitting = false;

	// My comment IDs (persisted in localStorage)
	let myCommentIds = [];

	const MAX_LENGTH = 200;
	const CHAR_THRESHOLD = 10;

	$: charsLeft = MAX_LENGTH - commentText.length;
	$: showCharsLeft = commentText.length > MAX_LENGTH - CHAR_THRESHOLD;
	$: isSubmitDisabled = submitting || !commentText.trim() || !password || password.length < 4 || commentText.length > MAX_LENGTH;

	onMount(() => {
		currentPath = $page.url.pathname;
		myCommentIds = JSON.parse(localStorage.getItem('myCommentIds') ?? '[]');
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
		editingId = null;
		loadComments();
	}

	async function loadComments() {
		try {
			const res = await fetch(`/api/comments?url=${encodeURIComponent($page.url.pathname)}`);
			if (res.ok) {
				const data = await res.json();
				comments = data.comments;
			}
		} catch {
			// silently fail
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

			// Store comment ID locally
			myCommentIds = [...myCommentIds, data.comment.id];
			localStorage.setItem('myCommentIds', JSON.stringify(myCommentIds));

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

	async function vote(commentId, voteType) {
		trigger([{ duration: 15 }], { intensity: 0.4 });
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
						? { ...c, upvotes: data.upvotes, downvotes: data.downvotes, score: data.upvotes - data.downvotes, myVote: data.myVote }
						: c
				);
			}
		} catch {
			// silently fail
		}
	}

	function startEdit(comment) {
		editingId = comment.id;
		editText = comment.text;
		editPassword = '';
		editError = '';
	}

	function cancelEdit() {
		editingId = null;
		editText = '';
		editPassword = '';
		editError = '';
	}

	async function saveEdit(commentId) {
		editError = '';
		if (!editText.trim()) { editError = 'Comment cannot be empty.'; return; }
		if (editText.length > MAX_LENGTH) { editError = `Max ${MAX_LENGTH} characters.`; return; }
		if (!editPassword) { editError = 'Password is required.'; return; }

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
			comments = comments.map((c) => c.id === commentId ? { ...c, text: data.comment.text, updatedAt: data.comment.updatedAt } : c);
			cancelEdit();
		} catch {
			editError = 'Something went wrong.';
		} finally {
			editSubmitting = false;
		}
	}
</script>

<div>
	<h3 class="mb-4 text-2xl font-semibold tracking-tight" id="comments">Comments</h3>

	<!-- Comment form -->
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
			on:click={() => { trigger([{ duration: 15 }], { intensity: 0.4 }); submitComment(); }}
			disabled={isSubmitDisabled}
			class="rounded-lg bg-neutral-900 p-2 px-4 font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
		>
			{submitting ? 'Submitting…' : 'Submit'}
		</button>
	</div>
</div>

<!-- Comment list -->
<div class="mt-8">
	{#if comments.length > 0}
		{#each comments as comment (comment.id)}
			<div
				class="mb-4 rounded-lg border border-neutral-200 bg-neutral-100 p-4 dark:border-neutral-800 dark:bg-neutral-900"
			>
				<!-- Header row -->
				<div class="flex flex-row items-start justify-between">
					<div class="flex flex-row items-center gap-2">
						<p class="font-semibold">{comment.username}</p>
					</div>
					<!-- Vote controls -->
					<div class="flex items-center space-x-2">
						<span class="font-medium">{comment.score}</span>
						<button
							on:click={() => vote(comment.id, 'up')}
							aria-label="Upvote"
							class="rounded-full p-1 transition-colors duration-200 {comment.myVote === 'up'
								? 'bg-green-500 text-white'
								: 'bg-neutral-200 text-neutral-600 hover:bg-green-200 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-green-800'}"
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
								<path fill-rule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clip-rule="evenodd" />
							</svg>
						</button>
						<button
							on:click={() => vote(comment.id, 'down')}
							aria-label="Downvote"
							class="rounded-full p-1 transition-colors duration-200 {comment.myVote === 'down'
								? 'bg-red-500 text-white'
								: 'bg-neutral-200 text-neutral-600 hover:bg-red-200 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-red-800'}"
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
								<path fill-rule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clip-rule="evenodd" />
							</svg>
						</button>
						{#if myCommentIds.includes(comment.id)}
							<button
								on:click={() => startEdit(comment)}
								aria-label="Edit comment"
								class="rounded-full bg-neutral-200 p-1 text-neutral-600 transition-colors duration-200 hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600"
							>
								<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
									<path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
								</svg>
							</button>
						{/if}
					</div>
				</div>

				<!-- Comment body or edit form -->
				{#if editingId === comment.id}
					<div class="mt-2">
						<textarea
							bind:value={editText}
							rows="3"
							maxlength={MAX_LENGTH}
							class="w-full resize-none rounded-lg border border-neutral-300 bg-white p-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:focus:ring-neutral-800"
						></textarea>
						<input
							bind:value={editPassword}
							type="password"
							placeholder="Your comment password"
							autocomplete="off"
							class="mt-2 w-full rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
						/>
						{#if editError}
							<p class="mt-1 text-xs text-red-500">{editError}</p>
						{/if}
						<div class="mt-2 flex gap-2">
							<button
								on:click={() => saveEdit(comment.id)}
								disabled={editSubmitting}
								class="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-neutral-900"
							>
								{editSubmitting ? 'Saving…' : 'Save'}
							</button>
							<button
								on:click={cancelEdit}
								class="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400"
							>
								Cancel
							</button>
						</div>
					</div>
				{:else}
					<p class="wrap-break-word mt-1 font-medium">{comment.text}</p>
				{/if}

				<p class="mt-1 text-sm font-medium text-neutral-500">
					{new Date(comment.createdAt).toLocaleString()}
					{#if comment.updatedAt && comment.updatedAt !== comment.createdAt}
						<span class="ml-1 text-xs">(edited)</span>
					{/if}
				</p>

				<!-- Admin reply -->
				{#if comment.reply}
					<div class="mt-4 rounded-lg bg-neutral-200 p-4 dark:bg-neutral-800">
						<p class="text-sm font-semibold text-neutral-600 dark:text-neutral-400">Admin Reply:</p>
						<p class="mt-1 text-neutral-900 dark:text-white">{comment.reply}</p>
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
