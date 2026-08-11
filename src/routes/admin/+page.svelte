<script>
	import { enhance } from '$app/forms';
	import { onDestroy } from 'svelte';
	import { useQuery } from 'convex-svelte';
	import { api } from '$convex/_generated/api';
	import AdminCommentNode from '$lib/comments/AdminCommentNode.svelte';
	import { buildTree } from '$lib/comments/build-tree.js';
	import { apiFetch } from '$lib/api-client.js';
	import { formatDateTime } from '$lib/format.js';

	let { data, form } = $props();

	let tab = $state('comments');

	// Comments navigation
	let view = $state('urls'); // 'urls' | 'comments'
	let selectedUrl = $state(null);

	// The session cookie, handed down by `load` — the credential these
	// subscriptions authenticate with. ADMIN_SECRET is never sent here; see
	// convex/lib/adminSession.js.
	const sessionToken = $derived(data.sessionToken ?? '');

	// Live admin data. Writes still go through /api/admin/*, which holds the real
	// secret — but their results arrive back here on the websocket, so nothing
	// below refetches after a reply, ban or delete.
	const urlsQuery = useQuery(api.admin.listUrls, () => (sessionToken ? { sessionToken } : 'skip'));
	const bansQuery = useQuery(api.bans.list, () => (sessionToken ? { sessionToken } : 'skip'));
	// Subscribed only while a post is open: one URL's thread is the only one the
	// screen can show, and every other subscription is a websocket update for
	// something nobody is looking at.
	const commentsQuery = useQuery(api.admin.listForUrl, () =>
		sessionToken && selectedUrl ? { url: selectedUrl, sessionToken } : 'skip'
	);

	const urlList = $derived(urlsQuery.data ?? []);
	const bans = $derived(bansQuery.data ?? []);

	// Cross-card form coordination
	let activeFormId = $state(null);
	function setActiveForm(id) {
		activeFormId = id;
	}

	// Error toast
	let errorMessage = $state('');
	let errorTimer = null;
	function showError(msg) {
		errorMessage = msg;
		if (errorTimer) clearTimeout(errorTimer);
		errorTimer = setTimeout(() => (errorMessage = ''), 4000);
	}
	onDestroy(() => {
		if (errorTimer) clearTimeout(errorTimer);
	});

	const statsTotal = $derived({
		comments: urlList.reduce((sum, u) => sum + u.count, 0),
		bans: bans.length
	});

	const commentTree = $derived(buildTree(commentsQuery.data ?? []));

	function selectUrl(url) {
		selectedUrl = url;
		view = 'comments';
		activeFormId = null;
	}

	function goBack() {
		view = 'urls';
		selectedUrl = null;
		activeFormId = null;
	}

	async function unban(id) {
		const res = await apiFetch(`/api/admin/bans/${id}`, { method: 'DELETE' });
		if (!res.ok) {
			showError(res.message ?? (res.networkError ? 'Something went wrong.' : 'Failed to unban.'));
		}
	}
</script>

<svelte:head>
	<title>Admin</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="mx-auto max-w-5xl px-4 py-12">
	{#if !data.authenticated}
		<div class="flex min-h-[60vh] items-center justify-center">
			<div
				class="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
			>
				<h1 class="mb-1 text-2xl font-semibold tracking-tight">Admin</h1>
				<p class="mb-6 text-sm text-neutral-500">Enter your admin password to continue.</p>

				{#if form?.error}
					<p
						class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400"
					>
						{form.error}
					</p>
				{/if}

				<form method="POST" action="?/login" use:enhance>
					<input
						type="password"
						name="password"
						placeholder="Password"
						autocomplete="current-password"
						class="mb-3 w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
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

		<div class="mb-6 grid grid-cols-2 gap-3">
			<div
				class="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900"
			>
				<p class="text-xs font-medium tracking-wider text-neutral-400 uppercase">Comments</p>
				<p class="tabular mt-1 text-3xl font-semibold">{statsTotal.comments}</p>
			</div>
			<div
				class="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900"
			>
				<p class="text-xs font-medium tracking-wider text-neutral-400 uppercase">Bans</p>
				<p class="tabular mt-1 text-3xl font-semibold">{statsTotal.bans}</p>
			</div>
		</div>

		<div
			class="mb-6 flex gap-1 rounded-xl border border-neutral-200 bg-neutral-100 p-1 dark:border-neutral-800 dark:bg-neutral-900"
		>
			<button
				onclick={() => (tab = 'comments')}
				class="flex-1 rounded-lg py-1.5 text-sm font-medium transition-all duration-150 {tab ===
				'comments'
					? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white'
					: 'text-neutral-500 hover:bg-white/60 hover:text-neutral-800 dark:hover:bg-neutral-800/50 dark:hover:text-neutral-200'}"
			>
				Comments
			</button>
			<button
				onclick={() => (tab = 'bans')}
				class="flex-1 rounded-lg py-1.5 text-sm font-medium transition-all duration-150 {tab ===
				'bans'
					? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white'
					: 'text-neutral-500 hover:bg-white/60 hover:text-neutral-800 dark:hover:bg-neutral-800/50 dark:hover:text-neutral-200'}"
			>
				Bans
			</button>
		</div>

		{#if tab === 'comments'}
			{#if view === 'urls'}
				{#if urlsQuery.error}
					<div class="py-16 text-center text-sm text-neutral-400 dark:text-neutral-500">
						Could not load posts.
					</div>
				{:else if urlsQuery.isLoading}
					<div class="py-16 text-center text-sm text-neutral-400 dark:text-neutral-500">
						Loading…
					</div>
				{:else if urlList.length === 0}
					<div class="py-16 text-center text-sm text-neutral-400 dark:text-neutral-500">
						No comments yet.
					</div>
				{:else}
					<div class="space-y-2">
						{#each urlList as item (item.url)}
							<button
								onclick={() => selectUrl(item.url)}
								class="flex w-full items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:bg-neutral-900"
							>
								<span class="font-mono text-sm text-neutral-700 dark:text-neutral-300"
									>{item.url}</span
								>
								<span
									class="tabular ml-4 shrink-0 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
								>
									{item.count}
								</span>
							</button>
						{/each}
					</div>
				{/if}
			{:else}
				<div class="mb-5 flex items-center gap-3">
					<button
						onclick={goBack}
						class="flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-900"
					>
						← All posts
					</button>
					<span class="truncate font-mono text-sm text-neutral-500">{selectedUrl}</span>
				</div>

				{#if commentsQuery.error}
					<div class="py-16 text-center text-sm text-neutral-400 dark:text-neutral-500">
						Could not load comments.
					</div>
				{:else if commentsQuery.isLoading}
					<div class="py-16 text-center text-sm text-neutral-400 dark:text-neutral-500">
						Loading…
					</div>
				{:else if commentTree.length === 0}
					<div class="py-16 text-center text-sm text-neutral-400 dark:text-neutral-500">
						No comments for this post.
					</div>
				{:else}
					<div class="space-y-4">
						{#each commentTree as comment (comment.id)}
							<AdminCommentNode {comment} {activeFormId} {setActiveForm} onError={showError} />
						{/each}
					</div>
				{/if}
			{/if}
		{:else if bansQuery.error}
			<div class="py-16 text-center text-sm text-neutral-400 dark:text-neutral-500">
				Could not load bans.
			</div>
		{:else if bansQuery.isLoading}
			<div class="py-16 text-center text-sm text-neutral-400 dark:text-neutral-500">Loading…</div>
		{:else if bans.length === 0}
			<div class="py-16 text-center text-sm text-neutral-400 dark:text-neutral-500">
				No active bans.
			</div>
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
							<p class="tabular mt-0.5 text-xs text-neutral-400">{formatDateTime(ban.createdAt)}</p>
						</div>
						<button
							onclick={() => unban(ban.id)}
							class="ml-4 shrink-0 rounded-lg border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800"
						>
							Unban
						</button>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>

{#if errorMessage}
	<div
		class="toast-in fixed right-4 bottom-4 z-50 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 shadow-lg dark:border-red-900 dark:bg-red-950/80 dark:text-red-400"
		role="alert"
	>
		{errorMessage}
	</div>
{/if}
