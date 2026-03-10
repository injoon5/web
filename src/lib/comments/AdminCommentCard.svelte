<script>
	export let comment;

	// Which action is open (held in parent, single active at a time)
	export let replyingTo = null;
	export let banningComment = null;

	// Two-way bound form state (shared with parent)
	export let replyText = '';
	export let banReason = '';

	// Callbacks
	export let onDelete = () => {};
	export let onStartReply = () => {};
	export let onSaveReply = () => {};
	export let onCancelReply = () => {};
	export let onStartBan = () => {};
	export let onConfirmBan = () => {};
	export let onCancelBan = () => {};
</script>

<div
	class="rounded-lg border border-neutral-200 bg-neutral-100 p-4 dark:border-neutral-800 dark:bg-neutral-900"
>
	<!-- Header: username + vote badges -->
	<div class="flex items-start justify-between gap-2">
		<p class="font-semibold">{comment.username}</p>
		<div class="flex shrink-0 items-center gap-1.5">
			<span
				class="inline-flex items-center gap-0.5 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-400"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clip-rule="evenodd" />
				</svg>
				{comment.upvotes}
			</span>
			<span
				class="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-400"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clip-rule="evenodd" />
				</svg>
				{comment.downvotes}
			</span>
		</div>
	</div>

	<!-- Comment text -->
	<p class="wrap-break-word mt-1 font-medium">{comment.text}</p>

	<!-- Timestamp + IP -->
	<p class="mt-1 text-sm font-medium text-neutral-500">
		{new Date(comment.createdAt).toLocaleString()}
		{#if comment.updatedAt && comment.updatedAt !== comment.createdAt}
			<span class="ml-1 text-xs">(edited)</span>
		{/if}
		<span class="ml-2 font-mono text-xs text-neutral-400">· {comment.ipHash.slice(0, 12)}…</span>
	</p>

	<!-- Admin reply -->
	{#if comment.reply && replyingTo !== comment.id}
		<div class="mt-3 rounded-lg bg-neutral-200 p-3 dark:bg-neutral-800">
			<p class="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Admin Reply:</p>
			<p class="mt-1 text-sm text-neutral-900 dark:text-white">{comment.reply}</p>
		</div>
	{/if}

	<!-- Action buttons -->
	<div class="mt-3 flex flex-wrap gap-2">
		<button
			on:click={() => (replyingTo === comment.id ? onCancelReply() : onStartReply(comment))}
			class="rounded-lg border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-200 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
		>
			{replyingTo === comment.id ? 'Cancel' : comment.reply ? 'Edit reply' : 'Reply'}
		</button>
		<button
			on:click={() => (banningComment === comment.id ? onCancelBan() : onStartBan(comment))}
			class="rounded-lg border border-amber-300 px-3 py-1 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/40"
		>
			{banningComment === comment.id ? 'Cancel' : 'Ban'}
		</button>
		<button
			on:click={() => onDelete(comment.id)}
			class="rounded-lg border border-red-300 px-3 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/40"
		>
			Delete
		</button>
	</div>

	<!-- Admin reply form -->
	{#if replyingTo === comment.id}
		<div class="mt-3 space-y-2 border-t border-neutral-200 pt-3 dark:border-neutral-700">
			<textarea
				bind:value={replyText}
				rows="3"
				placeholder="Write an admin reply…"
				class="w-full resize-none rounded-lg border border-neutral-300 bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
			></textarea>
			<div class="flex justify-end">
				<button
					on:click={() => onSaveReply(comment.id)}
					class="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
				>
					Save reply
				</button>
			</div>
		</div>
	{/if}

	<!-- Ban form -->
	{#if banningComment === comment.id}
		<div class="mt-3 space-y-2 border-t border-neutral-200 pt-3 dark:border-neutral-700">
			<input
				bind:value={banReason}
				type="text"
				placeholder="Reason (optional)"
				class="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
			/>
			<div class="flex justify-end">
				<button
					on:click={() => onConfirmBan(comment.id)}
					class="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-600"
				>
					Confirm ban
				</button>
			</div>
		</div>
	{/if}
</div>
