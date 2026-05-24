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
	const html = $derived(content ? marked.parse(content, { gfm: true, breaks: false }) : '');

	/** @type {Array<{ unit: Intl.RelativeTimeFormatUnit, secs: number }>} */
	const RELATIVE_UNITS = [
		{ unit: 'year', secs: 60 * 60 * 24 * 365 },
		{ unit: 'month', secs: 60 * 60 * 24 * 30 },
		{ unit: 'week', secs: 60 * 60 * 24 * 7 },
		{ unit: 'day', secs: 60 * 60 * 24 },
		{ unit: 'hour', secs: 60 * 60 },
		{ unit: 'minute', secs: 60 },
		{ unit: 'second', secs: 1 }
	];
	const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
	/** @param {Date} date */
	function formatRelative(date) {
		const diff = Math.round((date.getTime() - Date.now()) / 1000);
		const abs = Math.abs(diff);
		for (const { unit, secs } of RELATIVE_UNITS) {
			if (abs >= secs || unit === 'second') {
				return rtf.format(Math.round(diff / secs), unit);
			}
		}
		return rtf.format(diff, 'second');
	}

	/** @param {Date} date */
	function formatFull(date) {
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
	<meta property="og:title" content="Now — Injoon Oh" />
	<meta property="og:description" content="What Injoon Oh is doing now." />
	<meta property="og:image" content="https://www.injoon5.com/api/og?template=now" />
	<meta property="og:url" content="https://www.injoon5.com/now" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:image" content="https://www.injoon5.com/api/og?template=now" />
</svelte:head>

<div class="col-span-1 justify-center pt-10 lg:col-span-8 lg:col-start-3">
	<h1
		class="mt-20 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-2xl dark:text-neutral-100"
	>
		Now
	</h1>
	{#if !nowQuery.isLoading && updatedAt}
		<p
			class="text-xl font-medium tracking-tight text-neutral-500 dark:text-neutral-500"
			title={formatFull(updatedAt)}
		>
			Updated {formatRelative(updatedAt)}
		</p>
	{:else}
		<p class="text-xl font-medium tracking-tight text-neutral-500 dark:text-neutral-500">
			Loading...
		</p>
	{/if}

	<div class="my-12">
		{#if nowQuery.isLoading}
			<div class="space-y-3">
				{#each [75, 55, 90, 40, 70, 50] as w}
					<div class="shimmer h-4 rounded" style="width: {w}%"></div>
				{/each}
			</div>
		{:else if editing}
			<textarea
				use:autoResize
				bind:value={editContent}
				disabled={saving}
				class="min-h-[320px] w-full resize-none rounded-none border-0 bg-neutral-50 px-4 py-3 font-mono text-sm leading-relaxed text-neutral-900 transition-colors outline-none focus:ring-1 focus:ring-neutral-300 disabled:opacity-50 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:ring-neutral-700"
				placeholder="Write in markdown…"
				spellcheck="false"
				autocomplete="off"
			></textarea>
		{:else if html}
			<div
				class="prose prose-neutral dark:prose-invert prose-p:text-neutral-900
					dark:prose-p:text-neutral-100 prose-headings:font-semibold
					prose-headings:tracking-tight prose-h1:text-2xl
					prose-h1:mt-8 prose-h1:mb-2 prose-h2:text-xl
					prose-h2:mt-8 prose-h2:mb-2 prose-h3:text-lg
					prose-h3:mt-6 prose-h3:mb-1 prose-a:no-underline
					prose-a:hover:underline prose-li:text-neutral-900
					dark:prose-li:text-neutral-100 prose-ul:my-2
					prose-li:my-0.5 max-w-none
					text-base leading-relaxed"
			>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- admin-authored markdown -->
				{@html html}
			</div>
		{:else if data.isAdmin}
			<p class="text-base text-neutral-400 dark:text-neutral-600">
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
					class="rounded-lg bg-black px-4 py-2 text-sm font-medium text-neutral-100 transition-[background-color,transform] duration-150 ease-out hover:bg-neutral-800 active:scale-95 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
				>
					Edit
				</button>
			{:else}
				<button
					onclick={save}
					disabled={saving}
					class="rounded-lg bg-black px-4 py-2 text-sm font-medium text-neutral-100 transition-[background-color,transform] duration-150 ease-out hover:bg-neutral-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
				>
					{saving ? 'Saving…' : 'Save'}
				</button>
				<button
					onclick={cancelEdit}
					disabled={saving}
					class="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 transition-[background-color,transform] duration-150 ease-out hover:bg-neutral-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
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
