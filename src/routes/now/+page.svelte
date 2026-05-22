<script>
	import { useQuery } from 'convex-svelte';
	import { api } from '$convex/_generated/api';
	import { marked } from 'marked';

	const { data } = $props();

	const nowQuery = useQuery(api.now.get, () => ({}));

	let editing = $state(false);
	let editContent = $state('');
	let saving = $state(false);
	let saveError = $state('');

	const doc = $derived(nowQuery.data);
	const content = $derived(doc?.content ?? '');
	const updatedAt = $derived(doc?.updatedAt ? new Date(doc.updatedAt) : null);
	const html = $derived(
		content
			? marked.parse(content, { gfm: true, breaks: false })
			: ''
	);

	function formatDate(date) {
		return new Intl.DateTimeFormat('en', {
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		}).format(date);
	}

	function startEdit() {
		editContent = content;
		editing = true;
	}

	function cancelEdit() {
		editing = false;
		editContent = '';
		saveError = '';
	}

	async function save() {
		saving = true;
		saveError = '';
		try {
			const res = await fetch('/api/now', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ content: editContent })
			});
			if (!res.ok) {
				const d = await res.json().catch(() => ({}));
				saveError = d.message ?? 'Failed to save.';
				return;
			}
			editing = false;
		} catch {
			saveError = 'Something went wrong.';
		} finally {
			saving = false;
		}
	}

	function autoResize(node) {
		function resize() {
			node.style.height = 'auto';
			node.style.height = node.scrollHeight + 'px';
		}
		node.addEventListener('input', resize);
		resize();
		return { destroy: () => node.removeEventListener('input', resize) };
	}
</script>

<svelte:head>
	<title>Now — Injoon Oh</title>
	<meta name="description" content="What Injoon Oh is doing now." />
</svelte:head>

<div class="col-span-1 justify-center pt-10 lg:col-span-8 lg:col-start-3">
	<h1 class="mt-20 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-2xl dark:text-neutral-100">
		Now
	</h1>
{#if !nowQuery.isLoading && updatedAt}
		<p class="text-xl font-medium tracking-tight text-neutral-500 dark:text-neutral-500">Last updated {formatDate(updatedAt)}.</p>
	{/if}

	<div class="my-12">
		{#if nowQuery.isLoading}
			<div class="space-y-3">
				{#each [75, 55, 90, 40, 70, 50] as w}
					<div class="h-4 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" style="width: {w}%"></div>
				{/each}
			</div>
		{:else if editing}
			<textarea
				use:autoResize
				bind:value={editContent}
				disabled={saving}
				class="w-full min-h-[320px] resize-none rounded-none border-0 bg-neutral-50 dark:bg-neutral-900 px-4 py-3 font-mono text-sm text-neutral-900 dark:text-neutral-100 leading-relaxed outline-none focus:ring-1 focus:ring-neutral-300 dark:focus:ring-neutral-700 disabled:opacity-50 transition-colors"
				placeholder="Write in markdown…"
				spellcheck="false"
				autocomplete="off"
			></textarea>
		{:else if html}
			<div
				class="prose prose-neutral dark:prose-invert max-w-none
					prose-p:text-neutral-900 dark:prose-p:text-neutral-100
					prose-headings:font-semibold prose-headings:tracking-tight
					prose-h1:text-2xl prose-h1:mt-8 prose-h1:mb-2
					prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-2
					prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-1
					prose-a:no-underline prose-a:hover:underline
					prose-li:text-neutral-900 dark:prose-li:text-neutral-100
					prose-ul:my-2 prose-li:my-0.5
					text-base leading-relaxed"
			>
				{@html html}
			</div>
		{:else if data.isAdmin}
			<p class="text-sm text-neutral-400 dark:text-neutral-600">
				Nothing here yet. Click Edit to write something.
			</p>
		{:else}
			<p class="text-sm text-neutral-400 dark:text-neutral-600">Nothing here yet.</p>
		{/if}
	</div>

	{#if data.isAdmin}
		<div class="flex items-center gap-3">
			{#if !editing}
				<button
					onclick={startEdit}
					class="rounded-lg bg-black px-4 py-2 text-sm font-medium text-neutral-100 transition-all duration-150 hover:bg-neutral-800 active:scale-95 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
				>
					Edit
				</button>
			{:else}
				<button
					onclick={save}
					disabled={saving}
					class="rounded-lg bg-black px-4 py-2 text-sm font-medium text-neutral-100 transition-all duration-150 hover:bg-neutral-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
				>
					{saving ? 'Saving…' : 'Save'}
				</button>
				<button
					onclick={cancelEdit}
					disabled={saving}
					class="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 transition-all duration-150 hover:bg-neutral-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
				>
					Cancel
				</button>
			{/if}
			{#if saveError}
				<p class="text-sm text-red-500">{saveError}</p>
			{/if}
		</div>
	{/if}
</div>
