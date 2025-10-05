<script>
	import { page } from '$app/stores';
	import { redirect } from '@sveltejs/kit';
	import { onMount } from 'svelte';
	import PocketBase from 'pocketbase';

	const pb = new PocketBase('https://pb.injoon5.com');

	let comment = '';
	let comments = [];
	let replies = {};
	let currentPath = '';
	let usernameError = '';
	let commentError = '';
	let formSubmitted = false;

	const MAX_COMMENT_LENGTH = 200;
	const CHAR_THRESHOLD = 10;

	let commentCharsLeft = MAX_COMMENT_LENGTH;

	onMount(async () => {
		currentPath = $page.url.pathname;
		await loadComments();
	});

	// Watch for route changes
	$: if ($page.url.pathname !== currentPath) {
		currentPath = $page.url.pathname;
		comment = '';
		comments = [];
		usernameError = '';
		commentError = '';
		formSubmitted = false;
		loadComments();
	}

	$: commentCharsLeft = MAX_COMMENT_LENGTH - comment.length;

	$: showCommentCharsLeft = comment.length > MAX_COMMENT_LENGTH - CHAR_THRESHOLD;

	$: {
		if (formSubmitted) {
			commentError = comment.trim() ? '' : 'Comment is required';
		} else {
			commentError = '';
		}
		if (comment.length > MAX_COMMENT_LENGTH) {
			commentError = `Comment must be ${MAX_COMMENT_LENGTH} characters or less`;
		}
	}

	$: isSubmitDisabled = !comment.trim() || commentError;

	async function loadComments() {
		try {
			const records = await pb.collection('comments').getList(1, 50, {
				sort: '-created',
				expand: 'author,upvotes,downvotes,reply',
				filter: `url = "${$page.url.pathname}"`
			});
			comments = records.items.map((item) => ({
				...item,
				upvoteCount: Array.isArray(item.upvotes) ? item.upvotes.length : 0,
				downvoteCount: Array.isArray(item.downvotes) ? item.downvotes.length : 0,
				score:
					(Array.isArray(item.upvotes) ? item.upvotes.length : 0) -
					(Array.isArray(item.downvotes) ? item.downvotes.length : 0),
				username: item.expand?.author?.username || 'Unknown User'
			}));

			// Sort comments by score (descending) and then by creation date (descending)
			comments.sort((a, b) => {
				if (b.score !== a.score) {
					return b.score - a.score;
				}
				return new Date(b.created) - new Date(a.created);
			});
		} catch (error) {
			// console.error('Error loading comments:', error);
		}
	}

	async function submitComment() {
		formSubmitted = true;

		if (!pb.authStore.isValid) {
			alert('Please log in to submit a comment.');
			window.location.href = '/auth?goto=' + $page.url.pathname + '#comments';
			return;
		}

		if (!comment.trim()) {
			return; // Don't proceed if fields are empty
		}

		try {
			await pb.collection('comments').create({
				url: $page.url.pathname,
				author: pb.authStore.model?.id,
				text: comment
			});
			comment = '';
			formSubmitted = false; // Reset the form submitted state
			commentCharsLeft = MAX_COMMENT_LENGTH;
			await loadComments();
		} catch (error) {
			console.error('Error submitting comment:', error, pb.authStore.model.id);
			alert('Failed to submit comment. Please try again.');
		}
	}

	async function voteComment(commentId, voteType) {
		if (!pb.authStore.isValid) {
			alert('Please log in to vote.');
			window.location.href = '/auth?goto=' + $page.url.pathname;
			return;
		}

		try {
			const comment = await pb.collection('comments').getOne(commentId, {
				expand: 'upvotes,downvotes'
			});

			let upvotes = comment.upvotes || [];
			let downvotes = comment.downvotes || [];
			const userId = pb.authStore.model.id;

			if (voteType === 'upvote') {
				if (upvotes.includes(userId)) {
					upvotes = upvotes.filter((id) => id !== userId);
				} else {
					upvotes.push(userId);
					downvotes = downvotes.filter((id) => id !== userId);
				}
			} else {
				if (downvotes.includes(userId)) {
					downvotes = downvotes.filter((id) => id !== userId);
				} else {
					downvotes.push(userId);
					upvotes = upvotes.filter((id) => id !== userId);
				}
			}

			await pb.collection('comments').update(commentId, {
				upvotes: upvotes,
				downvotes: downvotes
			});

			await loadComments();
		} catch (error) {
			console.error('Error voting on comment:', error);
			alert('Failed to vote. Please try again.');
		}
	}
	async function deleteComment(commentId) {
		if (confirm('Are you sure you want to delete this comment?')) {
			try {
				await pb.collection('comments').delete(commentId);
				await loadComments();
			} catch (error) {
				console.error('Error deleting comment:', error);
				alert('Failed to delete comment. Please try again.');
			}
		}
	}

	function getUserVoteStatus(comment) {
		const userId = pb.authStore.model?.id;
		if (!userId) return { upvoted: false, downvoted: false };

		return {
			upvoted: comment.expand?.upvotes?.some((vote) => vote.id === userId) || false,
			downvoted: comment.expand?.downvotes?.some((vote) => vote.id === userId) || false
		};
	}

	function handleReply(commentId) {
		if (!replies[commentId]) {
			replies[commentId] = { text: '', show: true };
		} else {
			replies[commentId].show = !replies[commentId].show;
		}
		replies = { ...replies };
	}

	async function saveReply(commentId) {
		try {
			await pb.collection('comments').update(commentId, {
				reply: replies[commentId].text
			});

			// Clear the reply text and hide the reply box
			replies[commentId] = { text: '', show: false };
			replies = { ...replies };

			await loadComments();
		} catch (error) {
			console.error('Error saving reply:', error);
			alert('Failed to save reply. Please try again.');
		}
	}
</script>

<div>
	<h3 class="mb-4 text-2xl font-semibold tracking-tight" id="comments">Comments</h3>
	{#if pb.authStore.isValid}
		<div class="mt-2">
			<div>
				<textarea
					placeholder="Show me what you got.. (max {MAX_COMMENT_LENGTH} characters)"
					bind:value={comment}
					maxlength={MAX_COMMENT_LENGTH}
					class="h-32 w-full resize-none rounded-lg border border-neutral-300 bg-neutral-100 p-2 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white focus:dark:ring-neutral-800"
				></textarea>
				{#if showCommentCharsLeft}
					<p class="mt-1 text-sm text-neutral-500">
						Characters left: {commentCharsLeft}
					</p>
				{/if}
				{#if commentError}
					<p class="mt-1 text-sm text-red-500">{commentError}</p>
				{/if}
			</div>
			<button
				on:click={submitComment}
				disabled={isSubmitDisabled}
				class="mt-2 rounded-lg bg-neutral-900 p-2 px-4 font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
			>
				Submit
			</button>
		</div>
	{:else}
		<div class="flex h-full flex-col items-center justify-center">
			<p class="mt-2 grow-0 text-lg font-medium">Please login to leave a comment.</p>
			<a
				class="mt-2 grow-0 rounded-lg bg-neutral-900 p-2 px-4 font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
				href="/auth?goto={$page.url.pathname}#comments">Log in</a
			>
		</div>
	{/if}
</div>

<div class="mt-8">
	{#if comments.length > 0}
		{#each comments as comment}
			{@const voteStatus = getUserVoteStatus(comment)}
			<div
				class="mb-4 rounded-lg border border-neutral-200 bg-neutral-100 p-4 dark:border-neutral-800 dark:bg-neutral-900"
			>
				<div class="flex flex-row items-start justify-between">
					<div class="flex flex-row">
						<p class="font-semibold">{comment.username}</p>
						{#if comment.author == '214phugj014d7zb'}
							<p class="ml-2 text-sm text-neutral-500">Blog Owner</p>
						{/if}
					</div>
					<div class="flex items-center space-x-2">
						<span class="font-medium">{comment.score}</span>
						<button
							on:click={() => voteComment(comment.id, 'upvote')}
							aria-label="Upvote comment"
							class="rounded-full p-1 transition-colors duration-200 {voteStatus.upvoted
								? 'bg-green-500 text-white'
								: 'bg-neutral-200 text-neutral-600 hover:bg-green-200 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-green-800'}"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-5 w-5"
								viewBox="0 0 20 20"
								fill="currentColor"
							>
								<path
									fill-rule="evenodd"
									d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z"
									clip-rule="evenodd"
								/>
							</svg>
						</button>
						<button
							on:click={() => voteComment(comment.id, 'downvote')}
							aria-label="Downvote comment"
							class="rounded-full p-1 transition-colors duration-200 {voteStatus.downvoted
								? 'bg-red-500 text-white'
								: 'bg-neutral-200 text-neutral-600 hover:bg-red-200 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-red-800'}"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-5 w-5"
								viewBox="0 0 20 20"
								fill="currentColor"
							>
								<path
									fill-rule="evenodd"
									d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z"
									clip-rule="evenodd"
								/>
							</svg>
						</button>
						{#if pb.authStore.model?.id === '214phugj014d7zb'}
							<button
								on:click={() => handleReply(comment.id)}
								aria-label="Reply to comment"
								class="rounded-full bg-neutral-200 p-1 text-neutral-600 transition-colors duration-200 hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-5 w-5"
									viewBox="0 0 20 20"
									fill="currentColor"
								>
									<path
										fill-rule="evenodd"
										d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
										clip-rule="evenodd"
									/>
								</svg>
							</button>
							<button
								on:click={() => deleteComment(comment.id)}
								aria-label="Delete comment"
								class="rounded-full bg-red-500 p-1 text-white transition-colors duration-200 hover:bg-red-600"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-5 w-5"
									viewBox="0 0 20 20"
									fill="currentColor"
								>
									<path
										fill-rule="evenodd"
										d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
										clip-rule="evenodd"
									/>
								</svg>
							</button>
						{/if}
					</div>
				</div>
				<p class="break-words font-medium">{comment.text}</p>
				<p class="mt-1 font-medium text-sm text-neutral-500">{new Date(comment.created).toLocaleString()}</p>
				{#if pb.authStore.model?.id === '214phugj014d7zb'}
					{#if replies[comment.id] && replies[comment.id].show}
						<div class="mt-4 rounded-lg bg-neutral-200 p-4 dark:bg-neutral-800">
							<textarea
								bind:value={replies[comment.id].text}
								class="w-full resize-none rounded-lg border border-neutral-300 bg-white p-2 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white focus:dark:ring-neutral-800"
								placeholder="Enter your reply..."
								rows="3"
							></textarea>
							<div class="mt-2 flex justify-end">
								<button
									on:click={() => saveReply(comment.id)}
									class="rounded-lg bg-neutral-900 p-2 px-4 font-medium text-white transition-colors duration-200 hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
								>
									Save Reply
								</button>
							</div>
						</div>
					{/if}
				{/if}

				{#if comment.reply}
					<div class="mt-4 rounded-lg bg-neutral-200 p-4 dark:bg-neutral-800">
						<p class="text-sm font-semibold text-neutral-600 dark:text-neutral-400">Admin Reply:</p>
						<p class="mt-1 text-neutral-900 dark:text-white">{comment.reply}</p>
					</div>
				{/if}
			</div>
		{/each}
	{:else}
		<p class="font-medium text-neutral-500 dark:text-neutral-500 text-lg text-center pt-10">No comments yet. Be the first to comment!</p>
	{/if}
</div>
