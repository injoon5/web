<script>
	// All display + form state for a single comment card.
	// Edit, reply, and delete form state is held in the parent (CommentsSection) and
	// flows down as props so only one form is ever open at a time.

	import NumberFlow from '@number-flow/svelte';

	export let comment;

	// Which comment is being acted on (read-only booleans from parent)
	export let editingId = null;
	export let votingId = null;
	export let votingAnimId = null;
	export let votingSide = null;
	export let replyingToId = null;
	export let deletingId = null;

	// Edit form (two-way bound from parent, active when editingId === comment.id)
	export let editText = '';
	export let editPassword = '';
	export let editError = '';
	export let editSubmitting = false;

	// Reply form (two-way bound from parent, active when replyingToId === comment.id)
	export let replyText = '';
	export let replyUsername = '';
	export let replyPassword = '';
	export let replyError = '';
	export let replySubmitting = false;

	// Delete form (two-way bound from parent, active when deletingId === comment.id)
	export let deletePassword = '';
	export let deleteError = '';
	export let deleteSubmitting = false;

	export let MAX_LENGTH = 200;

	// Callbacks (parent handles logic + haptics)
	export let onVote = () => {};
	export let onStartEdit = () => {};
	export let onCancelEdit = () => {};
	export let onSaveEdit = () => {};
	export let onStartReply = () => {};
	export let onCancelReply = () => {};
	export let onSubmitReply = () => {};
	export let onStartDelete = () => {};
	export let onCancelDelete = () => {};
	export let onConfirmDelete = () => {};

	$: replyCharsLeft = MAX_LENGTH - replyText.length;
	$: showReplyCharsLeft = replyText.length > MAX_LENGTH - 10;
	$: replyDisabled =
		replySubmitting ||
		!replyText.trim() ||
		!replyPassword ||
		replyPassword.length < 4 ||
		replyText.length > MAX_LENGTH;

	$: isDeleted = comment.text === '[deleted]';
	$: isVoting = votingId === comment.id;
</script>

<div
	class="rounded-lg border border-neutral-200 bg-neutral-100 p-4 dark:border-neutral-800 dark:bg-neutral-900"
>
	<!-- Header: username + vote controls + edit/delete -->
	<div class="flex flex-row items-start justify-between">
		<p class="font-semibold {isDeleted ? 'text-neutral-400 dark:text-neutral-600' : ''}">{comment.username}</p>
		<div class="flex items-center space-x-2">
			<!-- Score with number-flow animation -->
			<NumberFlow value={comment.score} class="font-medium" />

			{#if !isDeleted}
				<!-- Upvote button -->
				<button
					on:click={() => onVote(comment.id, 'up')}
					disabled={isVoting}
					aria-label="Upvote"
					class="rounded-full p-1 transition-all duration-200 active:scale-90 disabled:cursor-not-allowed disabled:opacity-60
						{votingAnimId === comment.id && votingSide === 'up' ? 'vote-pop' : ''}
						{comment.myVote === 'up'
						? 'bg-green-500 text-white'
						: 'bg-neutral-200 text-neutral-600 hover:bg-green-200 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-green-800'}"
				>
					{#if isVoting && votingSide === 'up'}
						<!-- Loading spinner for upvote -->
						<svg class="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
						</svg>
					{:else}
						<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clip-rule="evenodd" />
						</svg>
					{/if}
				</button>

				<!-- Downvote button -->
				<button
					on:click={() => onVote(comment.id, 'down')}
					disabled={isVoting}
					aria-label="Downvote"
					class="rounded-full p-1 transition-all duration-200 active:scale-90 disabled:cursor-not-allowed disabled:opacity-60
						{votingAnimId === comment.id && votingSide === 'down' ? 'vote-pop' : ''}
						{comment.myVote === 'down'
						? 'bg-red-500 text-white'
						: 'bg-neutral-200 text-neutral-600 hover:bg-red-200 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-red-800'}"
				>
					{#if isVoting && votingSide === 'down'}
						<!-- Loading spinner for downvote -->
						<svg class="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
						</svg>
					{:else}
						<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clip-rule="evenodd" />
						</svg>
					{/if}
				</button>

				<!-- Edit button -->
				<button
					on:click={() => onStartEdit(comment)}
					aria-label="Edit comment"
					class="rounded-full bg-neutral-200 p-1 text-neutral-600 transition-all duration-200 active:scale-90 hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
						<path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
					</svg>
				</button>

				<!-- Delete button -->
				<button
					on:click={() => onStartDelete(comment)}
					aria-label="Delete comment"
					class="rounded-full bg-neutral-200 p-1 text-neutral-600 transition-all duration-200 active:scale-90 hover:bg-red-100 hover:text-red-600 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-red-900/40 dark:hover:text-red-400"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
					</svg>
				</button>
			{/if}
		</div>
	</div>

	<!-- Comment body or edit form -->
	{#if editingId === comment.id && !isDeleted}
		<div class="mt-2">
			<textarea
				bind:value={editText}
				rows="3"
				maxlength={MAX_LENGTH}
				class="w-full resize-none rounded-lg border border-neutral-300 bg-white p-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:ring-neutral-800"
			></textarea>
			<input
				bind:value={editPassword}
				type="password"
				placeholder="Your comment password"
				autocomplete="off"
				class="mt-2 w-full rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
			/>
			{#if editError}
				<p class="mt-1 text-xs text-red-500">{editError}</p>
			{/if}
			<div class="mt-2 flex gap-2">
				<button
					on:click={() => onSaveEdit(comment.id)}
					disabled={editSubmitting}
					class="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition-all duration-150 hover:bg-neutral-800 active:scale-95 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
				>
					{editSubmitting ? 'Saving…' : 'Save'}
				</button>
				<button
					on:click={onCancelEdit}
					class="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-600 transition-all duration-150 hover:bg-neutral-100 active:scale-95 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
				>
					Cancel
				</button>
			</div>
		</div>
	{:else if isDeleted}
		<p class="mt-1 text-sm italic text-neutral-400 dark:text-neutral-600">[deleted]</p>
	{:else}
		<p class="wrap-break-word mt-1 font-medium">{comment.text}</p>
	{/if}

	<!-- Delete confirmation form -->
	{#if deletingId === comment.id && !isDeleted}
		<div class="mt-3 space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/20">
			<p class="text-sm font-medium text-red-700 dark:text-red-400">Enter your password to permanently delete this comment.</p>
			<input
				bind:value={deletePassword}
				type="password"
				placeholder="Your comment password"
				autocomplete="off"
				class="w-full rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-red-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
			/>
			{#if deleteError}
				<p class="text-xs text-red-500">{deleteError}</p>
			{/if}
			<div class="flex gap-2">
				<button
					on:click={() => onConfirmDelete(comment.id)}
					disabled={deleteSubmitting || deletePassword.length < 4}
					class="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-all duration-150 hover:bg-red-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{deleteSubmitting ? 'Deleting…' : 'Delete'}
				</button>
				<button
					on:click={onCancelDelete}
					class="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-600 transition-all duration-150 hover:bg-neutral-100 active:scale-95 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
				>
					Cancel
				</button>
			</div>
		</div>
	{/if}

	<!-- Timestamp -->
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

	<!-- Reply form (inline, below the comment body) -->
	{#if replyingToId === comment.id}
		<div class="mt-3 space-y-2 border-t border-neutral-200 pt-3 dark:border-neutral-700">
			<input
				bind:value={replyUsername}
				type="text"
				placeholder="Name (optional)"
				maxlength="32"
				class="w-full rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:ring-neutral-800"
			/>
			<div>
				<textarea
					bind:value={replyText}
					placeholder="Reply… (max {MAX_LENGTH} characters)"
					maxlength={MAX_LENGTH}
					rows="2"
					class="w-full resize-none rounded-lg border border-neutral-300 bg-white p-2 text-sm text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:ring-neutral-800"
				></textarea>
				{#if showReplyCharsLeft}
					<p class="mt-0.5 text-xs text-neutral-500">Characters left: {replyCharsLeft}</p>
				{/if}
			</div>
			<input
				bind:value={replyPassword}
				type="password"
				placeholder="Password (save this to edit later)"
				autocomplete="off"
				class="w-full rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:ring-neutral-800"
			/>
			{#if replyError}
				<p class="text-xs text-red-500">{replyError}</p>
			{/if}
			<div class="flex gap-2">
				<button
					on:click={onSubmitReply}
					disabled={replyDisabled}
					class="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition-all duration-150 hover:bg-neutral-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
				>
					{replySubmitting ? 'Replying…' : 'Reply'}
				</button>
				<button
					on:click={onCancelReply}
					class="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-600 transition-all duration-150 hover:bg-neutral-100 active:scale-95 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
				>
					Cancel
				</button>
			</div>
		</div>
	{:else if comment.depth < 2 && editingId !== comment.id && deletingId !== comment.id && !isDeleted}
		<button
			on:click={() => onStartReply(comment)}
			class="mt-2 text-sm font-medium text-neutral-400 transition-colors duration-150 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-200"
		>
			Reply
		</button>
	{/if}
</div>
