<script>
	import Self from './AdminCommentNode.svelte';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';

	let {
		comment,
		activeFormId,
		setActiveForm,
		onChange,
		onError
	} = $props();

	let mode = $state(null); // 'reply' | 'ban' | 'delete' | null

	let replyText = $state('');
	let replySubmitting = $state(false);

	let banReason = $state('');
	let banSubmitting = $state(false);

	let deleteSubmitting = $state(false);

	$effect(() => {
		if (activeFormId !== comment.id && mode !== null) mode = null;
	});

	function openReply() {
		replyText = comment.reply ?? '';
		mode = 'reply';
		setActiveForm(comment.id);
	}

	function openBan() {
		banReason = '';
		mode = 'ban';
		setActiveForm(comment.id);
	}

	function openDelete() {
		mode = 'delete';
		setActiveForm(comment.id);
	}

	function closeForm() {
		mode = null;
		setActiveForm(null);
	}

	async function adminFetch(path, options) {
		return fetch(path, {
			...options,
			headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) }
		});
	}

	async function saveReply() {
		replySubmitting = true;
		try {
			const res = await adminFetch(`/api/admin/comments/${comment.id}`, {
				method: 'POST',
				body: JSON.stringify({ reply: replyText })
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				onError(data.message ?? 'Failed to save reply.');
				return;
			}
			closeForm();
			onChange();
		} catch {
			onError('Something went wrong.');
		} finally {
			replySubmitting = false;
		}
	}

	async function confirmBan() {
		banSubmitting = true;
		try {
			const res = await adminFetch('/api/admin/bans', {
				method: 'POST',
				body: JSON.stringify({ commentId: comment.id, reason: banReason || undefined })
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				onError(data.message ?? 'Failed to ban.');
				return;
			}
			closeForm();
			onChange();
		} catch {
			onError('Something went wrong.');
		} finally {
			banSubmitting = false;
		}
	}

	async function doDelete() {
		deleteSubmitting = true;
		try {
			const res = await adminFetch(`/api/admin/comments/${comment.id}`, { method: 'DELETE' });
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				onError(data.message ?? 'Failed to delete.');
				return;
			}
			closeForm();
			onChange();
		} catch {
			onError('Something went wrong.');
		} finally {
			deleteSubmitting = false;
		}
	}
</script>

<div>
	{#snippet card()}
	<div
		class="rounded-lg border border-neutral-200 bg-neutral-100 p-4 dark:border-neutral-800 dark:bg-neutral-900"
	>
		<!-- Header -->
		<div class="flex items-start justify-between gap-2">
			<p class="font-semibold">{comment.username}</p>
			<div class="flex shrink-0 items-center gap-1.5">
				<span
					class="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 tabular dark:bg-emerald-950/40 dark:text-emerald-400"
				>
					<ArrowUp size="12" strokeWidth="2.25" aria-hidden="true" />
					{comment.upvotes}
				</span>
				<span
					class="inline-flex items-center gap-0.5 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700 tabular dark:bg-rose-950/40 dark:text-rose-400"
				>
					<ArrowDown size="12" strokeWidth="2.25" aria-hidden="true" />
					{comment.downvotes}
				</span>
			</div>
		</div>

		<p class="mt-1 font-medium break-words">{comment.text}</p>

		<p class="mt-1 text-sm font-medium text-neutral-500">
			{new Date(comment.createdAt).toLocaleString()}
			{#if comment.updatedAt && comment.updatedAt !== comment.createdAt}
				<span class="ml-1 text-xs">(edited)</span>
			{/if}
			<span class="ml-2 font-mono text-xs text-neutral-400">· {comment.ipHash.slice(0, 12)}…</span>
		</p>

		{#if comment.reply && mode !== 'reply'}
			<div class="mt-3 rounded-lg bg-neutral-200 p-3 dark:bg-neutral-800">
				<p class="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Admin Reply:</p>
				<p class="mt-1 text-sm text-neutral-900 dark:text-white">{comment.reply}</p>
			</div>
		{/if}

		<div class="mt-3 flex flex-wrap gap-2">
			<button
				onclick={() => (mode === 'reply' ? closeForm() : openReply())}
				class="rounded-lg border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-200 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
			>
				{mode === 'reply' ? 'Cancel' : comment.reply ? 'Edit reply' : 'Reply'}
			</button>
			<button
				onclick={() => (mode === 'ban' ? closeForm() : openBan())}
				class="rounded-lg border border-amber-300 px-3 py-1 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/40"
			>
				{mode === 'ban' ? 'Cancel' : 'Ban'}
			</button>
			<button
				onclick={() => (mode === 'delete' ? closeForm() : openDelete())}
				class="rounded-lg border border-red-300 px-3 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/40"
			>
				{mode === 'delete' ? 'Cancel' : 'Delete'}
			</button>
		</div>

		{#if mode === 'reply'}
			<div class="mt-3 space-y-2 border-t border-neutral-200 pt-3 dark:border-neutral-700">
				<textarea
					bind:value={replyText}
					rows="3"
					placeholder="Write an admin reply… (leave empty to clear)"
					class="w-full resize-none rounded-lg border border-neutral-300 bg-white p-2 text-sm focus:ring-2 focus:ring-neutral-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
				></textarea>
				<div class="flex justify-end">
					<button
						onclick={saveReply}
						disabled={replySubmitting}
						class="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
					>
						{replySubmitting ? 'Saving…' : 'Save reply'}
					</button>
				</div>
			</div>
		{/if}

		{#if mode === 'ban'}
			<div class="mt-3 space-y-2 border-t border-neutral-200 pt-3 dark:border-neutral-700">
				<input
					bind:value={banReason}
					type="text"
					placeholder="Reason (optional)"
					class="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
				/>
				<div class="flex justify-end">
					<button
						onclick={confirmBan}
						disabled={banSubmitting}
						class="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
					>
						{banSubmitting ? 'Banning…' : 'Confirm ban'}
					</button>
				</div>
			</div>
		{/if}

		{#if mode === 'delete'}
			<div class="mt-3 border-t border-neutral-200 pt-3 dark:border-neutral-700">
				<p class="mb-2 text-xs text-neutral-500 dark:text-neutral-400">
					Permanently remove this comment? Replies will become orphaned.
				</p>
				<div class="flex flex-wrap gap-2">
					<button
						onclick={doDelete}
						disabled={deleteSubmitting}
						class="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
					>
						{deleteSubmitting ? 'Deleting…' : 'Delete'}
					</button>
				</div>
			</div>
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
						{onChange}
						{onError}
					/>
				{/each}
			</div>
		{/if}
	{/snippet}

	{#if comment.stray}
		<div
			class="rounded-lg border border-neutral-200 bg-neutral-100 p-4 opacity-70 dark:border-neutral-800 dark:bg-neutral-900"
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
