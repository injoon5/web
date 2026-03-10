<script>
	import { enhance } from '$app/forms';
	import { browser } from '$app/environment';
	import AdminCommentCard from '$lib/comments/AdminCommentCard.svelte';

	export let data;
	export let form;

	let tab = 'comments';
	let adminSecret = '';
	let bans = [];
	let statsTotal = { comments: 0, bans: 0 };

	// Comments navigation
	let view = 'urls'; // 'urls' | 'comments'
	let urlList = []; // [{ url, count }]
	let selectedUrl = null;
	let selectedComments = [];
	let loadingUrls = false;
	let loadingComments = false;

	// Admin action state (shared across comment cards — one form open at a time)
	let replyingTo = null;
	let replyText = '';
	let banningComment = null;
	let banReason = '';

	$: if (browser && data.authenticated) {
		adminSecret = data.adminSecret ?? '';
		loadUrlList();
		loadBans();
	}

	// Build nested comment tree from flat list (chronological children)
	function buildTree(flat) {
		const map = new Map();
		for (const c of flat) map.set(c.id, { ...c, children: [] });

		const roots = [];
		for (const node of map.values()) {
			if (node.parentId && map.has(node.parentId)) {
				map.get(node.parentId).children.push(node);
			} else if (!node.parentId) {
				roots.push(node);
			}
		}
		for (const node of map.values()) {
			node.children.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
		}
		return roots;
	}

	$: commentTree = buildTree(selectedComments);

	async function apiFetch(path, options = {}) {
		return fetch(path, {
			...options,
			headers: {
				'Content-Type': 'application/json',
				'x-admin-secret': adminSecret,
				...(options.headers ?? {})
			}
		});
	}

	async function loadUrlList() {
		loadingUrls = true;
		try {
			const res = await apiFetch('/api/admin/comments');
			if (res.ok) {
				const d = await res.json();
				urlList = d.urls;
				statsTotal.comments = d.urls.reduce((sum, u) => sum + u.count, 0);
			}
		} finally {
			loadingUrls = false;
		}
	}

	async function selectUrl(url) {
		selectedUrl = url;
		view = 'comments';
		selectedComments = [];
		replyingTo = null;
		banningComment = null;
		loadingComments = true;
		try {
			const res = await apiFetch(`/api/admin/comments?url=${encodeURIComponent(url)}`);
			if (res.ok) {
				const d = await res.json();
				selectedComments = d.comments;
			}
		} finally {
			loadingComments = false;
		}
	}

	function goBack() {
		view = 'urls';
		selectedUrl = null;
		selectedComments = [];
		replyingTo = null;
		banningComment = null;
	}

	async function loadBans() {
		const res = await apiFetch('/api/admin/bans');
		if (res.ok) {
			const d = await res.json();
			bans = d.bans;
			statsTotal.bans = d.bans.length;
		}
	}

	async function deleteComment(id) {
		if (!confirm('Delete this comment?')) return;
		const res = await apiFetch(`/api/admin/comments/${id}`, { method: 'DELETE' });
		if (res.ok) {
			selectedComments = selectedComments.filter((c) => c.id !== id);
			urlList = urlList.map((u) =>
				u.url === selectedUrl ? { ...u, count: u.count - 1 } : u
			);
			statsTotal.comments--;
		}
	}

	function startReply(comment) {
		replyingTo = comment.id;
		replyText = comment.reply ?? '';
		banningComment = null;
		banReason = '';
	}

	function cancelReply() {
		replyingTo = null;
		replyText = '';
	}

	async function saveReply(id) {
		const res = await apiFetch(`/api/admin/comments/${id}`, {
			method: 'POST',
			body: JSON.stringify({ reply: replyText })
		});
		if (res.ok) {
			selectedComments = selectedComments.map((c) =>
				c.id === id ? { ...c, reply: replyText || null } : c
			);
			replyingTo = null;
			replyText = '';
		}
	}

	function startBan(comment) {
		banningComment = comment.id;
		banReason = '';
		replyingTo = null;
		replyText = '';
	}

	function cancelBan() {
		banningComment = null;
		banReason = '';
	}

	async function confirmBan(commentId) {
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

	async function unban(id) {
		const res = await apiFetch(`/api/admin/bans/${id}`, { method: 'DELETE' });
		if (res.ok) {
			bans = bans.filter((b) => b.id !== id);
			statsTotal.bans--;
		}
	}

	function formatDate(d) {
		return new Date(d).toLocaleString();
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
					class="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm text-neutral-600 transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-900"
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
				on:click={() => { tab = 'comments'; }}
				class="flex-1 rounded-lg py-1.5 text-sm font-medium transition-all duration-150 {tab === 'comments'
					? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white'
					: 'text-neutral-500 hover:bg-white/60 hover:text-neutral-800 dark:hover:bg-neutral-800/50 dark:hover:text-neutral-200'}"
			>
				Comments
			</button>
			<button
				on:click={() => { tab = 'bans'; }}
				class="flex-1 rounded-lg py-1.5 text-sm font-medium transition-all duration-150 {tab === 'bans'
					? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white'
					: 'text-neutral-500 hover:bg-white/60 hover:text-neutral-800 dark:hover:bg-neutral-800/50 dark:hover:text-neutral-200'}"
			>
				Bans
			</button>
		</div>

		{#if tab === 'comments'}
			{#if view === 'urls'}
				<!-- URL list -->
				{#if loadingUrls}
					<div class="py-16 text-center text-sm text-neutral-400 dark:text-neutral-500">Loading…</div>
				{:else if urlList.length === 0}
					<div class="py-16 text-center text-sm text-neutral-400 dark:text-neutral-500">No comments yet.</div>
				{:else}
					<div class="space-y-2">
						{#each urlList as item (item.url)}
							<button
								on:click={() => selectUrl(item.url)}
								class="flex w-full items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:bg-neutral-900"
							>
								<span class="font-mono text-sm text-neutral-700 dark:text-neutral-300">{item.url}</span>
								<span class="ml-4 shrink-0 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
									{item.count}
								</span>
							</button>
						{/each}
					</div>
				{/if}
			{:else}
				<!-- Comment tree for selected URL -->
				<div class="mb-5 flex items-center gap-3">
					<button
						on:click={goBack}
						class="flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-900"
					>
						← All posts
					</button>
					<span class="truncate font-mono text-sm text-neutral-500">{selectedUrl}</span>
				</div>

				{#if loadingComments}
					<div class="py-16 text-center text-sm text-neutral-400 dark:text-neutral-500">Loading…</div>
				{:else if commentTree.length === 0}
					<div class="py-16 text-center text-sm text-neutral-400 dark:text-neutral-500">No comments for this post.</div>
				{:else}
					<div>
						{#each commentTree as comment (comment.id)}
							<div class="mb-4">
								<!-- Depth 0 -->
								<AdminCommentCard
									{comment}
									{replyingTo}
									{banningComment}
									bind:replyText
									bind:banReason
									onDelete={deleteComment}
									onStartReply={startReply}
									onSaveReply={saveReply}
									onCancelReply={cancelReply}
									onStartBan={startBan}
									onConfirmBan={confirmBan}
									onCancelBan={cancelBan}
								/>

								<!-- Depth 1 replies -->
								{#if comment.children.length > 0}
									<div class="mt-2 ml-4 space-y-2 border-l-2 border-neutral-200 pl-4 dark:border-neutral-700">
										{#each comment.children as reply (reply.id)}
											<AdminCommentCard
												comment={reply}
												{replyingTo}
												{banningComment}
												bind:replyText
												bind:banReason
												onDelete={deleteComment}
												onStartReply={startReply}
												onSaveReply={saveReply}
												onCancelReply={cancelReply}
												onStartBan={startBan}
												onConfirmBan={confirmBan}
												onCancelBan={cancelBan}
											/>

											<!-- Depth 2 replies -->
											{#if reply.children.length > 0}
												<div class="ml-4 space-y-2 border-l-2 border-neutral-200/70 pl-4 dark:border-neutral-700/70">
													{#each reply.children as subreply (subreply.id)}
														<AdminCommentCard
															comment={subreply}
															{replyingTo}
															{banningComment}
															bind:replyText
															bind:banReason
															onDelete={deleteComment}
															onStartReply={startReply}
															onSaveReply={saveReply}
															onCancelReply={cancelReply}
															onStartBan={startBan}
															onConfirmBan={confirmBan}
															onCancelBan={cancelBan}
														/>
													{/each}
												</div>
											{/if}
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			{/if}
		{:else}
			<!-- Bans tab -->
			{#if bans.length === 0}
				<div class="py-16 text-center text-sm text-neutral-400 dark:text-neutral-500">No active bans.</div>
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
								class="ml-4 shrink-0 rounded-lg border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800"
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
