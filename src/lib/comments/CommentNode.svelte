<script>
	import NumberFlow from '@number-flow/svelte';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Self from './CommentNode.svelte';
	import { MAX_COMMENT_LENGTH, CHAR_THRESHOLD, MIN_PASSWORD_LENGTH } from './constants.js';

	const MAX_LENGTH = MAX_COMMENT_LENGTH;

	let {
		comment,
		activeFormId,
		setActiveForm,
		votingIds,
		votingAnim,
		canVote = true,
		voteKnown = true,
		onVote,
		onHaptic
	} = $props();

	let mode = $state(null); // 'edit' | 'reply' | 'delete' | null

	// Edit form state
	let editText = $state('');
	let editPassword = $state('');
	let editError = $state('');
	let editSubmitting = $state(false);

	// Reply form state
	let replyText = $state('');
	let replyUsername = $state('');
	let replyPassword = $state('');
	let replyError = $state('');
	let replySubmitting = $state(false);

	// Delete form state
	let deletePassword = $state('');
	let deleteError = $state('');
	let deleteSubmitting = $state(false);

	const isDeleted = $derived(comment.text === '[deleted]');
	const isVoting = $derived(votingIds.has(comment.id));
	// Only reflect the visitor's vote once it's trustworthy (see CommentsSection);
	// otherwise show neutral arrows so a stale/unknown state can't be mis-toggled.
	const myVote = $derived(voteKnown ? comment.myVote : null);
	const voteDisabled = $derived(isVoting || !canVote);
	const replyCharsLeft = $derived(MAX_LENGTH - replyText.length);
	const showReplyCharsLeft = $derived(replyText.length > MAX_LENGTH - CHAR_THRESHOLD);
	const replyDisabled = $derived(
		replySubmitting ||
			!replyText.trim() ||
			!replyPassword ||
			replyPassword.length < MIN_PASSWORD_LENGTH ||
			replyText.length > MAX_LENGTH
	);

	// Close own form when another card claims the active slot
	$effect(() => {
		if (activeFormId !== comment.id && mode !== null) {
			mode = null;
		}
	});

	function openEdit() {
		editText = comment.text;
		editPassword = '';
		editError = '';
		mode = 'edit';
		setActiveForm(comment.id);
	}

	function openReply() {
		onHaptic();
		replyText = '';
		replyUsername = '';
		replyPassword = '';
		replyError = '';
		mode = 'reply';
		setActiveForm(comment.id);
	}

	function openDelete() {
		deletePassword = '';
		deleteError = '';
		mode = 'delete';
		setActiveForm(comment.id);
	}

	function closeForm() {
		mode = null;
		setActiveForm(null);
	}

	async function saveEdit() {
		editError = '';
		if (!editText.trim()) return (editError = 'Comment cannot be empty.');
		if (editText.length > MAX_LENGTH) return (editError = `Max ${MAX_LENGTH} characters.`);
		if (!editPassword) return (editError = 'Password is required.');

		editSubmitting = true;
		try {
			const res = await fetch(`/api/comments/${comment.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text: editText.trim(), password: editPassword })
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				editError = data.message ?? 'Failed to save.';
				return;
			}
			closeForm();
		} catch {
			editError = 'Something went wrong.';
		} finally {
			editSubmitting = false;
		}
	}

	async function submitReply() {
		replyError = '';
		if (!replyText.trim()) return (replyError = 'Reply cannot be empty.');
		if (replyPassword.length < MIN_PASSWORD_LENGTH)
			return (replyError = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
		if (replyText.length > MAX_LENGTH) return (replyError = `Max ${MAX_LENGTH} characters.`);

		replySubmitting = true;
		try {
			const res = await fetch('/api/comments', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					url: comment.url,
					username: replyUsername.trim() || undefined,
					password: replyPassword,
					text: replyText.trim(),
					parentId: comment.id
				})
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				replyError = data.message ?? data.error ?? 'Failed to submit reply.';
				return;
			}
			closeForm();
		} catch {
			replyError = 'Something went wrong. Please try again.';
		} finally {
			replySubmitting = false;
		}
	}

	async function confirmDelete() {
		deleteError = '';
		if (deletePassword.length < MIN_PASSWORD_LENGTH)
			return (deleteError = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);

		deleteSubmitting = true;
		try {
			const res = await fetch(`/api/comments/${comment.id}`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ password: deletePassword })
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				deleteError = data.message ?? 'Failed to delete comment.';
				return;
			}
			closeForm();
		} catch {
			deleteError = 'Something went wrong.';
		} finally {
			deleteSubmitting = false;
		}
	}

	function handleVote(side) {
		onHaptic();
		onVote(comment.id, side);
	}
</script>

<div>
	{#snippet card()}
		<div
			class="rounded-xl p-4 transition-colors duration-150 {isDeleted
				? 'border border-dashed border-neutral-300/80 bg-transparent dark:border-neutral-700/80'
				: 'border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900'}"
		>
			<!-- Header: username + vote/edit/delete -->
			<div class="flex flex-row items-center justify-between gap-2">
				<p
					class="leading-none font-semibold {isDeleted
						? 'text-neutral-400 italic dark:text-neutral-600'
						: ''}"
				>
					{comment.username}
				</p>
				<div class="flex shrink-0 items-center gap-1.5">
					{#if !isDeleted}
						<span
							class="tabular min-w-[1.25rem] text-center text-sm leading-none font-medium text-neutral-700 dark:text-neutral-300"
						>
							<NumberFlow value={comment.score} trend={0} />
						</span>

						<button
							onclick={() => handleVote('up')}
							disabled={voteDisabled}
							aria-label="Upvote"
							aria-pressed={myVote === 'up'}
							class="rounded-full p-2 transition-[background-color,color,transform] duration-150 ease-out active:scale-90 disabled:cursor-not-allowed disabled:opacity-60
						{votingAnim.id === comment.id && votingAnim.side === 'up' ? 'vote-pop' : ''}
						{myVote === 'up'
								? 'bg-emerald-200 text-emerald-800 dark:bg-emerald-900/70 dark:text-emerald-300'
								: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-950/60'}"
						>
							{#if isVoting && votingAnim.side === 'up'}
								<LoaderCircle size="16" class="animate-spin" aria-hidden="true" />
							{:else}
								<ArrowUp size="16" strokeWidth="2.25" aria-hidden="true" />
							{/if}
						</button>

						<button
							onclick={() => handleVote('down')}
							disabled={voteDisabled}
							aria-label="Downvote"
							aria-pressed={myVote === 'down'}
							class="rounded-full p-2 transition-[background-color,color,transform] duration-150 ease-out active:scale-90 disabled:cursor-not-allowed disabled:opacity-60
						{votingAnim.id === comment.id && votingAnim.side === 'down' ? 'vote-pop' : ''}
						{myVote === 'down'
								? 'bg-rose-200 text-rose-800 dark:bg-rose-900/70 dark:text-rose-300'
								: 'bg-rose-100 text-rose-700 hover:bg-rose-200/80 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-950/60'}"
						>
							{#if isVoting && votingAnim.side === 'down'}
								<LoaderCircle size="16" class="animate-spin" aria-hidden="true" />
							{:else}
								<ArrowDown size="16" strokeWidth="2.25" aria-hidden="true" />
							{/if}
						</button>

						<button
							onclick={openEdit}
							aria-label="Edit comment"
							class="rounded-full p-2 text-neutral-500 transition-[background-color,color,transform] duration-150 ease-out hover:text-neutral-900 active:scale-90 dark:text-neutral-400 dark:hover:text-neutral-100"
						>
							<Pencil size="16" strokeWidth="2" aria-hidden="true" />
						</button>

						<button
							onclick={openDelete}
							aria-label="Delete comment"
							class="rounded-full p-2 text-neutral-500 transition-[background-color,color,transform] duration-150 ease-out hover:text-rose-600 active:scale-90 dark:text-neutral-400 dark:hover:text-rose-400"
						>
							<Trash2 size="16" strokeWidth="2" aria-hidden="true" />
						</button>
					{/if}
				</div>
			</div>

			<!-- Body or edit form -->
			{#if mode === 'edit' && !isDeleted}
				<div class="mt-2">
					<textarea
						bind:value={editText}
						rows="3"
						maxlength={MAX_LENGTH}
						class="w-full resize-none rounded-lg border border-neutral-300 bg-white p-2 text-sm focus:ring-2 focus:ring-neutral-200 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:ring-neutral-800"
					></textarea>
					<input
						bind:value={editPassword}
						type="password"
						placeholder="Your comment password"
						autocomplete="off"
						class="mt-2 w-full rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:ring-2 focus:ring-neutral-200 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
					/>
					{#if editError}
						<p class="mt-1 text-xs text-red-500">{editError}</p>
					{/if}
					<div class="mt-2 flex gap-2">
						<button
							onclick={saveEdit}
							disabled={editSubmitting}
							class="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition-[background-color,transform] duration-150 hover:bg-neutral-800 active:scale-95 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
						>
							{editSubmitting ? 'Saving…' : 'Save'}
						</button>
						<button
							onclick={closeForm}
							class="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-600 transition-[background-color,transform] duration-150 hover:bg-neutral-100 active:scale-95 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
						>
							Cancel
						</button>
					</div>
				</div>
			{:else if isDeleted}
				<p class="mt-1 text-sm text-neutral-400 italic dark:text-neutral-600">[deleted]</p>
			{:else}
				<p class="mt-1 font-medium break-words">{comment.text}</p>
			{/if}

			<!-- Delete confirm -->
			{#if mode === 'delete' && !isDeleted}
				<div
					class="mt-3 space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/20"
				>
					<p class="text-sm font-medium text-red-700 dark:text-red-400">
						Enter your password to permanently delete this comment.
					</p>
					<input
						bind:value={deletePassword}
						type="password"
						placeholder="Your comment password"
						autocomplete="off"
						class="w-full rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:ring-2 focus:ring-red-200 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
					/>
					{#if deleteError}
						<p class="text-xs text-red-500">{deleteError}</p>
					{/if}
					<div class="flex gap-2">
						<button
							onclick={confirmDelete}
							disabled={deleteSubmitting || deletePassword.length < MIN_PASSWORD_LENGTH}
							class="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-[background-color,transform] duration-150 hover:bg-red-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{deleteSubmitting ? 'Deleting…' : 'Delete'}
						</button>
						<button
							onclick={closeForm}
							class="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-600 transition-[background-color,transform] duration-150 hover:bg-neutral-100 active:scale-95 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
						>
							Cancel
						</button>
					</div>
				</div>
			{/if}

			<!-- Timestamp -->
			<p class="tabular mt-1 text-sm font-medium text-neutral-500">
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

			<!-- Reply form / reply button -->
			{#if mode === 'reply'}
				<div class="mt-3 space-y-2 border-t border-neutral-200 pt-3 dark:border-neutral-700">
					<input
						bind:value={replyUsername}
						type="text"
						placeholder="Name (optional)"
						maxlength="32"
						class="w-full rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 focus:ring-2 focus:ring-neutral-200 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:ring-neutral-800"
					/>
					<div>
						<textarea
							bind:value={replyText}
							placeholder="Reply… (max {MAX_LENGTH} characters)"
							maxlength={MAX_LENGTH}
							rows="2"
							class="w-full resize-none rounded-lg border border-neutral-300 bg-white p-2 text-sm text-neutral-900 focus:ring-2 focus:ring-neutral-200 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:ring-neutral-800"
						></textarea>
						{#if showReplyCharsLeft}
							<p class="tabular mt-0.5 text-xs text-neutral-500">
								Characters left: {replyCharsLeft}
							</p>
						{/if}
					</div>
					<input
						bind:value={replyPassword}
						type="password"
						placeholder="Password (save this to edit later)"
						autocomplete="off"
						class="w-full rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 focus:ring-2 focus:ring-neutral-200 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:ring-neutral-800"
					/>
					{#if replyError}
						<p class="text-xs text-red-500">{replyError}</p>
					{/if}
					<div class="flex gap-2">
						<button
							onclick={submitReply}
							disabled={replyDisabled}
							class="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition-[background-color,transform] duration-150 hover:bg-neutral-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
						>
							{replySubmitting ? 'Replying…' : 'Reply'}
						</button>
						<button
							onclick={closeForm}
							class="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-600 transition-[background-color,transform] duration-150 hover:bg-neutral-100 active:scale-95 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
						>
							Cancel
						</button>
					</div>
				</div>
			{:else if comment.depth < 2 && mode === null && !isDeleted}
				<button
					onclick={openReply}
					class="mt-2 text-sm font-medium text-neutral-400 transition-colors duration-150 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-200"
				>
					Reply
				</button>
			{/if}
		</div>
	{/snippet}

	{#snippet kids()}
		{#if comment.children && comment.children.length > 0}
			<div
				class="mt-2 ml-4 space-y-2 border-l-2 pl-4 {comment.depth === 0
					? 'border-neutral-200 dark:border-neutral-700'
					: 'border-neutral-200/70 dark:border-neutral-700/70'}"
			>
				{#each comment.children as child (child.id)}
					<Self
						comment={child}
						{activeFormId}
						{setActiveForm}
						{votingIds}
						{votingAnim}
						{canVote}
						{voteKnown}
						{onVote}
						{onHaptic}
					/>
				{/each}
			</div>
		{/if}
	{/snippet}

	{#if comment.stray}
		<!-- Ghost placeholder for the deleted parent (renders at comment.depth - 1) -->
		<div
			class="rounded-xl border border-dashed border-neutral-300/80 p-4 opacity-80 dark:border-neutral-700/80"
		>
			<p class="font-semibold text-neutral-400 italic dark:text-neutral-600">[deleted]</p>
			<p class="mt-1 text-sm text-neutral-400 italic dark:text-neutral-600">[deleted]</p>
		</div>
		<div
			class="mt-2 ml-4 space-y-2 border-l-2 pl-4 {comment.depth === 1
				? 'border-neutral-200 dark:border-neutral-700'
				: 'border-neutral-200/70 dark:border-neutral-700/70'}"
		>
			{@render card()}
			{@render kids()}
		</div>
	{:else}
		{@render card()}
		{@render kids()}
	{/if}
</div>
