<script lang="ts">
	// All display + form state for a single comment card.
	// Edit and reply form state is held in the parent (CommentsSection) and
	// flows down as props so only one form is ever open at a time.

	export let comment: any;

	// Which comment is being acted on (read-only booleans from parent)
	export let editingId: string | null = null;
	export let votingId: string | null = null;
	export let votingAnimId: string | null = null;
	export let votingSide: string | null = null;
	export let replyingToId: string | null = null;

	// Edit form (two-way bound from parent, active when editingId === comment.id)
	export let editText: string = '';
	export let editPassword: string = '';
	export let editError: string = '';
	export let editSubmitting: boolean = false;

	// Reply form (two-way bound from parent, active when replyingToId === comment.id)
	export let replyText: string = '';
	export let replyUsername: string = '';
	export let replyPassword: string = '';
	export let replyError: string = '';
	export let replySubmitting: boolean = false;

	export let MAX_LENGTH: number = 200;

	// Callbacks (parent handles logic + haptics)
	export let onVote: (id: string, voteType: string) => void = () => {};
	export let onStartEdit: (comment: any) => void = () => {};
	export let onCancelEdit: () => void = () => {};
	export let onSaveEdit: (id: string) => void = () => {};
	export let onStartReply: (comment: any) => void = () => {};
	export let onCancelReply: () => void = () => {};
	export let onSubmitReply: () => void = () => {};

	$: replyCharsLeft = MAX_LENGTH - replyText.length;
	$: showReplyCharsLeft = replyText.length > MAX_LENGTH - 10;
	$: replyDisabled =
		replySubmitting ||
		!replyText.trim() ||
		!replyPassword ||
		replyPassword.length < 4 ||
		replyText.length > MAX_LENGTH;
</script>

<div
	class="rounded-lg border border-neutral-200 bg-neutral-100 p-4 dark:border-neutral-800 dark:bg-neutral-900"
>
	<!-- Header: username + vote controls + edit -->
	<div class="flex flex-row items-start justify-between">
		<p class="font-semibold">{comment.username}</p>
		<div class="flex items-center space-x-2">
			<span class="font-medium">{comment.score}</span>
			<button
				on:click={() => onVote(comment.id, 'up')}
				disabled={votingId === comment.id}
				aria-label="Upvote"
				class="rounded-full p-1 transition-all duration-200 active:scale-90 disabled:opacity-50
					{votingAnimId === comment.id && votingSide === 'up' ? 'vote-pop' : ''}
					{comment.myVote === 'up'
					? 'bg-green-500 text-white'
					: 'bg-neutral-200 text-neutral-600 hover:bg-green-200 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-green-800'}"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clip-rule="evenodd" />
				</svg>
			</button>
			<button
				on:click={() => onVote(comment.id, 'down')}
				disabled={votingId === comment.id}
				aria-label="Downvote"
				class="rounded-full p-1 transition-all duration-200 active:scale-90 disabled:opacity-50
					{votingAnimId === comment.id && votingSide === 'down' ? 'vote-pop' : ''}
					{comment.myVote === 'down'
					? 'bg-red-500 text-white'
					: 'bg-neutral-200 text-neutral-600 hover:bg-red-200 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-red-800'}"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clip-rule="evenodd" />
				</svg>
			</button>
			<button
				on:click={() => onStartEdit(comment)}
				aria-label="Edit comment"
				class="rounded-full bg-neutral-200 p-1 text-neutral-600 transition-all duration-200 active:scale-90 hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
					<path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
				</svg>
			</button>
		</div>
	</div>

	<!-- Comment body or edit form -->
	{#if editingId === comment.id}
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
	{:else}
		<p class="wrap-break-word mt-1 font-medium">{comment.text}</p>
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
	{:else if comment.depth < 2 && editingId !== comment.id}
		<button
			on:click={() => onStartReply(comment)}
			class="mt-2 text-sm font-medium text-neutral-400 transition-colors duration-150 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-200"
		>
			Reply
		</button>
	{/if}
</div>
