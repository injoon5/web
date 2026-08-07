<script>
	import { page } from '$app/state';
	import LifeField from './LifeField.svelte';
	import ErrorDialsMount from './ErrorDialsMount.svelte';

	/**
	 * The error page, shared by both `+error.svelte` boundaries.
	 *
	 * Two beats. A poster — the status code stamped into a Life field, the type in
	 * the lower third where the numeral is not — then, on `onrelease`, the numeral
	 * arrives as real type while the stage collapses to half a viewport. The field
	 * keeps running but never stamps again, so nothing lands on the type.
	 */

	/** Flipped by the field when the stamp stops being held. */
	let settled = $state(false);

	const status = $derived(page.status ?? 500);
	const pathname = $derived(page.url?.pathname ?? '');

	/** The short name for the status, set under the numeral as the eyebrow. */
	const label = $derived.by(() => {
		if (status === 404) return 'Not found';
		if (status === 403) return 'Forbidden';
		if (status === 401) return 'Unauthorized';
		if (status === 410) return 'Gone';
		if (status === 429) return 'Too many requests';
		if (status >= 500) return 'Server error';
		return 'Error';
	});

	const heading = $derived.by(() => {
		if (status === 404) {
			if (pathname.startsWith('/blog/')) return "Couldn't find that post";
			if (pathname.startsWith('/projects/')) return "Couldn't find that project";
			if (pathname.startsWith('/blog')) return "Couldn't find the blog";
			if (pathname.startsWith('/projects')) return "Couldn't find that project";
			if (pathname.startsWith('/now')) return "Couldn't find the /now page";
			return "Couldn't find that page";
		}
		if (status === 403) return "You don't have access to that";
		if (status === 401) return 'You need to sign in to see that';
		if (status === 429) return 'Slow down for a moment';
		if (status >= 500) return 'The server tripped over itself';
		return 'Something went wrong';
	});

	/**
	 * SvelteKit's own messages for these are the status name again — printing
	 * "Not Found" under a heading that already says so is noise, so a message
	 * only survives if it adds something.
	 */
	const GENERIC = new Set(['not found', 'forbidden', 'unauthorized', 'internal error', 'error']);
	const message = $derived.by(() => {
		const raw = page.error?.message?.trim();
		if (!raw || GENERIC.has(raw.toLowerCase())) return '';
		return raw;
	});

	/**
	 * Somewhere useful to go next, chosen from where they were headed. A missing
	 * post is a reason to show the blog, not a reason to send someone home.
	 */
	const elsewhere = $derived.by(() => {
		if (pathname.startsWith('/blog')) return { href: '/blog', label: 'Browse the blog' };
		if (pathname.startsWith('/projects')) return { href: '/projects', label: 'See the projects' };
		if (pathname.startsWith('/health')) return { href: '/health', label: 'See the health page' };
		return null;
	});
</script>

<svelte:head>
	<title>{status} — {label}</title>
	<meta name="robots" content="noindex" />
	<!-- Without scripting there is no field, so there is no numeral being held
	     and nothing to wait for: the page is its settled composition from the
	     start. Unscoped on purpose — it comes after `app.css` in the head, which
	     is what lets it outrank the poster state at equal specificity. -->
	<noscript>
		<style>
			.error-stage {
				min-height: calc(70svh - 4rem);
				padding-bottom: 6vh;
			}
			.error-number {
				grid-template-rows: 1fr;
			}
			.error-number > span {
				opacity: 1;
				filter: none;
			}
		</style>
	</noscript>
</svelte:head>

<LifeField text={String(status)} onrelease={() => (settled = true)} />
<ErrorDialsMount />

<!-- Bottom-anchored rather than centred: the numeral in the field owns the
     middle of the viewport, and the type owns the space below it. The stage
     shrinking is what moves the type up — see `.error-stage` in `app.css`. -->
<section class="error-stage flex flex-col justify-end text-center" data-settled={settled}>
	<!-- The numeral the field was holding, arriving as type: the same weight it
	     was stamped at, one step darker than the cells so it reads as a letter
	     rather than as more field. Size is what makes it the subject of the page,
	     not colour — it stays as quiet as the eyebrow and outsizes the heading.
	     Its row is zero-height until the handoff, so during the poster beat it
	     cannot push the heading up into the stamp. -->
	<p class="error-number" data-settled={settled}>
		<span
			class="block pb-4 text-7xl leading-none font-semibold tracking-[-0.04em] text-neutral-400 tabular-nums sm:pb-6 sm:text-[7rem] dark:text-neutral-600"
		>
			{status}
		</span>
	</p>

	<p
		class="error-in font-mono text-[11px] font-medium tracking-[0.18em] text-neutral-400 uppercase tabular-nums sm:text-xs dark:text-neutral-600"
	>
		{label}
	</p>

	<h1
		class="error-in mt-4 text-4xl leading-[1.05] font-semibold tracking-[-0.03em] text-balance text-neutral-900 sm:text-6xl lg:text-7xl dark:text-neutral-100"
		style="--stagger:60ms"
	>
		{heading}
	</h1>

	{#if message}
		<p
			class="error-in mx-auto mt-5 max-w-md text-base text-pretty text-neutral-500 sm:text-lg dark:text-neutral-400"
			style="--stagger:120ms"
		>
			{message}
		</p>
	{:else if status === 404 && pathname}
		<p
			class="error-in mx-auto mt-5 max-w-full text-sm text-neutral-400 sm:text-base dark:text-neutral-600"
			style="--stagger:120ms"
		>
			<span class="truncate font-mono">{pathname}</span> doesn't exist.
		</p>
	{/if}

	<div
		class="error-in mt-9 flex items-center justify-center gap-5 text-base font-medium sm:gap-6 sm:text-lg"
		style="--stagger:180ms"
	>
		<a
			href="/"
			class="group relative inline-block rounded-xs text-neutral-900 transition-colors duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-4 active:text-neutral-500 dark:text-neutral-100 dark:focus-visible:ring-neutral-600"
		>
			Go home
			<!-- A real underline can only animate its colour, so the rule is its own
			     element: it grows from the left on the way in and retreats to the
			     right on the way out, which reads as one gesture rather than two. -->
			<span
				aria-hidden="true"
				class="absolute -bottom-0.5 left-0 h-px w-full origin-right scale-x-0 bg-current transition-transform duration-200 ease-out group-hover:origin-left group-hover:scale-x-100"
			></span>
		</a>

		{#if elsewhere}
			<span aria-hidden="true" class="text-neutral-300 dark:text-neutral-700">·</span>
			<a
				href={elsewhere.href}
				class="group relative inline-block rounded-xs text-neutral-500 transition-colors duration-150 ease-out outline-none hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-4 active:text-neutral-400 dark:text-neutral-500 dark:hover:text-neutral-100 dark:focus-visible:ring-neutral-600"
			>
				{elsewhere.label}
				<span
					aria-hidden="true"
					class="absolute -bottom-0.5 left-0 h-px w-full origin-right scale-x-0 bg-current transition-transform duration-200 ease-out group-hover:origin-left group-hover:scale-x-100"
				></span>
			</a>
		{/if}
	</div>
</section>
