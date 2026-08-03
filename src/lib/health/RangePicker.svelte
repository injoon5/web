<script>
	import { Spring } from 'svelte/motion';

	/**
	 * The range picker, as a radio group with one sliding indicator.
	 *
	 * The selected pill is a single element that moves between the options rather
	 * than a background that blinks from one button to another. It rides a spring,
	 * so a second click mid-slide re-aims from wherever the pill currently is and
	 * keeps the velocity it already had — no restart, no jump back.
	 *
	 * Keyboard selection skips the animation on purpose: arrow keys repeat, and an
	 * indicator easing toward a target the user has already moved past reads as
	 * lag rather than motion.
	 */
	let { ranges, value, onselect } = $props();

	/**
	 * Near-critically damped: a click carries no momentum, so the pill travels
	 * without overshooting. Slack enough to settle in ~300ms — fast enough to feel
	 * immediate, slow enough that the eye reads it as one thing moving rather than
	 * a background appearing somewhere else.
	 */
	const SPRING = { stiffness: 0.15, damping: 0.88, precision: 0.1 };

	const x = new Spring(0, SPRING);
	const width = new Spring(0, SPRING);

	/** @type {HTMLButtonElement[]} */
	let buttons = $state([]);
	let container = $state();

	// Until the first measurement the pill has no box to occupy, so the selected
	// button carries its own background. That is also what server-rendered HTML
	// shows before this component ever runs.
	let measured = $state(false);

	let first = true;
	let skipAnimation = false;

	function reducedMotion() {
		return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
	}

	function measure(instant) {
		const el = buttons[ranges.indexOf(value)];
		if (!el || !container) return;

		// `offsetLeft`/`offsetWidth` round to whole pixels, and the buttons rarely
		// land on them: a pill measured that way sits up to a pixel narrow or a
		// pixel off-centre, which is exactly the sliver of background that shows
		// on one side of the label and not the other. Rects are fractional.
		const box = el.getBoundingClientRect();
		const origin = container.getBoundingClientRect();

		// A box of zero width is not a measurement — it is a subtree with no
		// layout yet. Taking it would hand the pill nothing to draw and drop the
		// button's own background at the same time, leaving no selection visible
		// at all. Hold the fallback until there is a real box; the resize observer
		// re-measures the moment there is one.
		if (!box.width) return;

		x.set(box.left - origin.left, { instant });
		width.set(box.width, { instant });
		measured = true;
	}

	$effect(() => {
		value;
		buttons;
		// The first paint and a keyboard move both land the pill outright; only a
		// click is worth animating.
		const instant = first || skipAnimation || reducedMotion();
		first = false;
		skipAnimation = false;
		measure(instant);
	});

	// A resize (or a late web font) changes the boxes under the pill. That is a
	// layout change rather than a selection, so it never animates.
	$effect(() => {
		if (!container) return;
		const observer = new ResizeObserver(() => measure(true));
		observer.observe(container);
		return () => observer.disconnect();
	});

	function select(range, instant = false) {
		if (range === value) return;
		skipAnimation = instant;
		onselect?.(range);
	}

	function onkeydown(event) {
		const current = ranges.indexOf(value);
		let next;

		switch (event.key) {
			case 'ArrowRight':
			case 'ArrowDown':
				next = (current + 1) % ranges.length;
				break;
			case 'ArrowLeft':
			case 'ArrowUp':
				next = (current - 1 + ranges.length) % ranges.length;
				break;
			case 'Home':
				next = 0;
				break;
			case 'End':
				next = ranges.length - 1;
				break;
			default:
				return;
		}

		event.preventDefault();
		select(ranges[next], true);
		buttons[next]?.focus();
	}
</script>

<!-- `-ml-2.5` pulls the first pill's own padding back so the `7` lines up with
     the column edge, not the pill. `max-w-full` keeps the row inside the column
     on the narrowest phones, where four pills plus the word run close. -->
<div class="-ml-2.5 flex max-w-full items-center text-sm sm:-ml-3">
	<!-- A radio group, not a row of toggles: exactly one is always chosen, and
	     arrow keys are the expected way through it. Roving tabindex keeps the
	     group a single tab stop. -->
	<div
		bind:this={container}
		role="radiogroup"
		aria-label="Range in days"
		tabindex="-1"
		class="relative flex min-w-0 items-center gap-0.5 focus:outline-none sm:gap-1"
		{onkeydown}
	>
		<div
			aria-hidden="true"
			class="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-neutral-100 dark:bg-neutral-800"
			class:invisible={!measured}
			style="width: {width.current}px; transform: translateX({x.current}px)"
		></div>

		{#each ranges as range, i (range)}
			<button
				bind:this={buttons[i]}
				type="button"
				role="radio"
				aria-checked={range === value}
				tabindex={range === value ? 0 : -1}
				onclick={() => select(range)}
				class="relative rounded-full px-2.5 py-1.5 font-medium tabular-nums transition-colors duration-150 ease-out select-none after:absolute after:inset-x-0 after:-inset-y-2 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-400 sm:px-3 {range ===
				value
					? `text-neutral-900 dark:text-neutral-100 ${measured ? '' : 'bg-neutral-100 dark:bg-neutral-800'}`
					: 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-100'}"
			>
				{range}
			</button>
		{/each}
	</div>
	<span class="ml-2 text-neutral-400 dark:text-neutral-600">days</span>
</div>
