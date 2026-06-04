<script>
	import { enhance } from '$app/forms';
	import { onDestroy } from 'svelte';
	import AdminCommentNode from '$lib/comments/AdminCommentNode.svelte';
	import { buildTree } from '$lib/comments/buildTree.js';

	let { data, form } = $props();

	let tab = $state('comments');

	// Comments navigation
	let view = $state('urls'); // 'urls' | 'comments'
	let selectedUrl = $state(null);

	// Server-fetched data
	let urlList = $state([]);
	let selectedComments = $state([]);
	let bans = $state([]);

	let loadingUrls = $state(false);
	let loadingComments = $state(false);
	let loadingBans = $state(false);

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

	async function loadUrls() {
		loadingUrls = true;
		try {
			const res = await fetch('/api/admin/comments');
			if (!res.ok) {
				showError('Failed to load posts.');
				return;
			}
			const body = await res.json();
			urlList = body.urls ?? [];
		} catch {
			showError('Failed to load posts.');
		} finally {
			loadingUrls = false;
		}
	}

	async function loadComments(url) {
		loadingComments = true;
		try {
			const res = await fetch(`/api/admin/comments?url=${encodeURIComponent(url)}`);
			if (!res.ok) {
				showError('Failed to load comments.');
				return;
			}
			const body = await res.json();
			selectedComments = body.comments ?? [];
		} catch {
			showError('Failed to load comments.');
		} finally {
			loadingComments = false;
		}
	}

	async function loadBans() {
		loadingBans = true;
		try {
			const res = await fetch('/api/admin/bans');
			if (!res.ok) {
				showError('Failed to load bans.');
				return;
			}
			const body = await res.json();
			bans = body.bans ?? [];
		} catch {
			showError('Failed to load bans.');
		} finally {
			loadingBans = false;
		}
	}

	// Reactive fetches when auth/tab/view changes
	$effect(() => {
		if (!data.authenticated) return;
		if (tab === 'comments' && view === 'urls') loadUrls();
		if (tab === 'comments' && view === 'comments' && selectedUrl) loadComments(selectedUrl);
		if (tab === 'bans') loadBans();
	});

	const statsTotal = $derived({
		comments: urlList.reduce((sum, u) => sum + u.count, 0),
		bans: bans.length
	});

	const commentTree = $derived(buildTree(selectedComments));

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

	function onCommentChanged() {
		if (selectedUrl) loadComments(selectedUrl);
	}

	async function unban(id) {
		try {
			const res = await fetch(`/api/admin/bans/${id}`, { method: 'DELETE' });
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				showError(body.message ?? 'Failed to unban.');
				return;
			}
			loadBans();
		} catch {
			showError('Something went wrong.');
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
				{#if loadingUrls}
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

				{#if loadingComments}
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
							<AdminCommentNode
								{comment}
								{activeFormId}
								{setActiveForm}
								onChange={onCommentChanged}
								onError={showError}
							/>
						{/each}
					</div>
				{/if}
			{/if}
		{:else if loadingBans}
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
							<p class="tabular mt-0.5 text-xs text-neutral-400">{formatDate(ban.createdAt)}</p>
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
