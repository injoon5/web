<script lang="ts">
	import { enhance } from '$app/forms';

	export let data;
	export let form;

	let tab: 'comments' | 'bans' = 'comments';
	let adminSecret = '';
	let comments: any[] = [];
	let bans: any[] = [];
	let loading = false;
	let statsTotal = { comments: 0, bans: 0 };

	// Reply state
	let replyingTo: string | null = null;
	let replyText = '';

	// Ban reason
	let banReason = '';
	let banningComment: string | null = null;

	$: if (data.authenticated) {
		adminSecret = getCookieValue('admin_token') ?? '';
		loadComments();
		loadBans();
	}

	function getCookieValue(name: string): string | undefined {
		return document.cookie
			.split('; ')
			.find((row) => row.startsWith(name + '='))
			?.split('=')[1];
	}

	async function apiFetch(path: string, options: RequestInit = {}) {
		return fetch(path, {
			...options,
			headers: {
				'Content-Type': 'application/json',
				'x-admin-secret': adminSecret,
				...(options.headers ?? {})
			}
		});
	}

	async function loadComments() {
		loading = true;
		try {
			const res = await apiFetch('/api/admin/comments');
			if (res.ok) {
				const d = await res.json();
				comments = d.comments;
				statsTotal.comments = d.comments.length;
			}
		} finally {
			loading = false;
		}
	}

	async function loadBans() {
		const res = await apiFetch('/api/admin/bans');
		if (res.ok) {
			const d = await res.json();
			bans = d.bans;
			statsTotal.bans = d.bans.length;
		}
	}

	async function deleteComment(id: string) {
		if (!confirm('Delete this comment?')) return;
		const res = await apiFetch(`/api/admin/comments/${id}`, { method: 'DELETE' });
		if (res.ok) {
			comments = comments.filter((c) => c.id !== id);
			statsTotal.comments--;
		}
	}

	async function saveReply(id: string) {
		const res = await apiFetch(`/api/admin/comments/${id}`, {
			method: 'POST',
			body: JSON.stringify({ reply: replyText })
		});
		if (res.ok) {
			comments = comments.map((c) => (c.id === id ? { ...c, reply: replyText || null } : c));
			replyingTo = null;
			replyText = '';
		}
	}

	async function banCommenter(commentId: string) {
		const res = await apiFetch('/api/admin/bans', {
			method: 'POST',
			body: JSON.stringify({ commentId, reason: banReason || undefined })
		});
		if (res.ok) {
			banningComment = null;
			banReason = '';
			await loadBans();
		}
	}

	async function unban(id: string) {
		const res = await apiFetch(`/api/admin/bans/${id}`, { method: 'DELETE' });
		if (res.ok) {
			bans = bans.filter((b) => b.id !== id);
			statsTotal.bans--;
		}
	}

	function formatDate(d: string) {
		return new Date(d).toLocaleString();
	}

	function truncate(s: string, n = 80) {
		return s.length > n ? s.slice(0, n) + '…' : s;
	}
</script>

<svelte:head>
	<title>Admin</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="mx-auto max-w-5xl px-4 py-12">
	{#if !data.authenticated}
		<!-- Login screen -->
		<div class="flex min-h-[60vh] items-center justify-center">
			<div
				class="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
			>
				<h1 class="mb-1 text-2xl font-semibold tracking-tight">Admin</h1>
				<p class="mb-6 text-sm text-neutral-500">Enter your admin password to continue.</p>

				{#if form?.error}
					<p class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
						{form.error}
					</p>
				{/if}

				<form method="POST" action="?/login" use:enhance>
					<input
						type="password"
						name="password"
						placeholder="Password"
						autocomplete="current-password"
						class="mb-3 w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
					/>
					<button
						type="submit"
						class="w-full rounded-lg bg-neutral-900 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
					>
						Sign in
					</button>
				</form>
			</div>
		</div>
	{:else}
		<!-- Dashboard -->
		<div class="mb-8 flex items-center justify-between">
			<div>
				<h1 class="text-2xl font-semibold tracking-tight">Admin Dashboard</h1>
				<p class="mt-0.5 text-sm text-neutral-500">Manage comments, replies, and bans.</p>
			</div>
			<form method="POST" action="?/logout" use:enhance>
				<button
					type="submit"
					class="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-900"
				>
					Sign out
				</button>
			</form>
		</div>

		<!-- Stats -->
		<div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
			<div
				class="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900"
			>
				<p class="text-xs font-medium uppercase tracking-wider text-neutral-400">Comments</p>
				<p class="mt-1 text-3xl font-semibold">{statsTotal.comments}</p>
			</div>
			<div
				class="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900"
			>
				<p class="text-xs font-medium uppercase tracking-wider text-neutral-400">Bans</p>
				<p class="mt-1 text-3xl font-semibold">{statsTotal.bans}</p>
			</div>
		</div>

		<!-- Tabs -->
		<div class="mb-6 flex gap-1 rounded-xl border border-neutral-200 bg-neutral-100 p-1 dark:border-neutral-800 dark:bg-neutral-900">
			<button
				on:click={() => tab = 'comments'}
				class="flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors {tab === 'comments'
					? 'bg-white shadow-sm dark:bg-neutral-800 dark:text-white'
					: 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'}"
			>
				Comments
			</button>
			<button
				on:click={() => tab = 'bans'}
				class="flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors {tab === 'bans'
					? 'bg-white shadow-sm dark:bg-neutral-800 dark:text-white'
					: 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'}"
			>
				Bans
			</button>
		</div>

		{#if tab === 'comments'}
			{#if loading}
				<div class="py-16 text-center text-sm text-neutral-400">Loading…</div>
			{:else if comments.length === 0}
				<div class="py-16 text-center text-sm text-neutral-400">No comments yet.</div>
			{:else}
				<div class="space-y-3">
					{#each comments as comment (comment.id)}
						<div
							class="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950"
						>
							<!-- Header -->
							<div class="flex flex-wrap items-start justify-between gap-2">
								<div>
									<span class="font-semibold">{comment.username}</span>
									<span class="ml-2 text-xs text-neutral-400">{comment.url}</span>
									<span class="ml-2 text-xs text-neutral-400">{formatDate(comment.createdAt)}</span>
								</div>
								<div class="flex items-center gap-1.5">
									<span class="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-400">
										↑{comment.upvotes}
									</span>
									<span class="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-400">
										↓{comment.downvotes}
									</span>
								</div>
							</div>

							<!-- Text -->
							<p class="mt-2 text-sm leading-relaxed break-words">{comment.text}</p>

							<!-- Existing reply -->
							{#if comment.reply}
								<div class="mt-2 rounded-lg bg-neutral-100 px-3 py-2 dark:bg-neutral-800">
									<p class="text-xs font-semibold text-neutral-500">Admin reply:</p>
									<p class="mt-0.5 text-sm">{comment.reply}</p>
								</div>
							{/if}

							<!-- IP hash -->
							<p class="mt-1.5 font-mono text-xs text-neutral-400">
								ip: {comment.ipHash.slice(0, 16)}…
							</p>

							<!-- Actions -->
							<div class="mt-3 flex flex-wrap gap-2">
								<button
									on:click={() => {
										replyingTo = replyingTo === comment.id ? null : comment.id;
										replyText = comment.reply ?? '';
									}}
									class="rounded-lg border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-900"
								>
									{replyingTo === comment.id ? 'Cancel' : 'Reply'}
								</button>
								<button
									on:click={() => {
										banningComment = banningComment === comment.id ? null : comment.id;
										banReason = '';
									}}
									class="rounded-lg border border-amber-200 px-3 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-400 dark:hover:bg-amber-950/30"
								>
									{banningComment === comment.id ? 'Cancel' : 'Ban'}
								</button>
								<button
									on:click={() => deleteComment(comment.id)}
									class="rounded-lg border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
								>
									Delete
								</button>
							</div>

							<!-- Reply form -->
							{#if replyingTo === comment.id}
								<div class="mt-3">
									<textarea
										bind:value={replyText}
										rows="3"
										placeholder="Write a reply…"
										class="w-full resize-none rounded-lg border border-neutral-300 bg-neutral-50 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
									></textarea>
									<div class="mt-2 flex justify-end gap-2">
										<button
											on:click={() => saveReply(comment.id)}
											class="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
										>
											Save reply
										</button>
									</div>
								</div>
							{/if}

							<!-- Ban form -->
							{#if banningComment === comment.id}
								<div class="mt-3">
									<input
										bind:value={banReason}
										type="text"
										placeholder="Reason (optional)"
										class="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
									/>
									<div class="mt-2 flex justify-end gap-2">
										<button
											on:click={() => banCommenter(comment.id)}
											class="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600"
										>
											Confirm ban
										</button>
									</div>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		{:else}
			<!-- Bans tab -->
			{#if bans.length === 0}
				<div class="py-16 text-center text-sm text-neutral-400">No active bans.</div>
			{:else}
				<div class="space-y-2">
					{#each bans as ban (ban.id)}
						<div
							class="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-950"
						>
							<div>
								<p class="font-mono text-sm">{ban.ipHash.slice(0, 24)}…</p>
								{#if ban.reason}
									<p class="mt-0.5 text-xs text-neutral-500">{ban.reason}</p>
								{/if}
								<p class="mt-0.5 text-xs text-neutral-400">{formatDate(ban.createdAt)}</p>
							</div>
							<button
								on:click={() => unban(ban.id)}
								class="ml-4 shrink-0 rounded-lg border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-900"
							>
								Unban
							</button>
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	{/if}
</div>
