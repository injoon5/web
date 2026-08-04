<!--
	pasito's `<Stepper />`, ported from the React component at
	https://github.com/joshpuckett/pasito. The props and the `--pill-*` theming
	API are the upstream ones, so the README over there still reads true.

	Upstream splits this into `Stepper.tsx` + `Step.tsx`. Here the step markup is
	inlined: Svelte scopes styles per component, and half of pasito's stylesheet
	is `.pasito-vertical .pasito-step`-shaped descendant rules that would each
	need a `:global()` hole punched through the boundary. One component keeps the
	stylesheet a faithful copy and keeps the scoping honest.
-->
<script>
	import { untrack } from 'svelte';
	import { computeStepWindow, StepAnimator } from './core.js';

	let {
		/** Total number of steps. */
		count,
		/** Zero-based active step index. */
		active,
		/** Called with the index of a clicked step. Omit for a read-only stepper. */
		onStepClick = undefined,
		/** @type {'horizontal' | 'vertical'} */
		orientation = 'horizontal',
		/** Steps visible before the track starts windowing. */
		maxVisible = undefined,
		/** Transition duration in ms. */
		transitionDuration = 500,
		/** CSS transition timing function. */
		easing = undefined,
		/** Extra class, for `--pill-*` overrides. */
		class: className = '',
		/** Show fill progress on the active step (autoplay mode). */
		filling = false,
		/** Duration of the fill animation in ms. */
		fillDuration = 3000,
		/** Accessible name for the stepper as a whole. */
		label = 'Progress steps',
		/**
		 * Upstream is always a `tablist` of `tab`s. A stepper that isn't picking
		 * between tab panels — the lightbox's, say — can say so instead of
		 * claiming a relationship that isn't in the DOM.
		 */
		containerRole = 'tablist',
		stepRole = 'tab',
		/** Accessible name for one step. @type {(index: number, count: number) => string} */
		stepLabel = (index) => `Step ${index + 1}`
	} = $props();

	/** Matches `.pasito-exiting`'s transition-duration, with a frame to spare. */
	const EXIT_DURATION = 300;

	const stepWindow = $derived(computeStepWindow(count, active, maxVisible, orientation));
	const vertical = $derived(orientation === 'vertical');

	// --- animating steps -----------------------------------------------------
	// The animator is stateful across count changes, so it can't be a $derived.
	// `untrack` says what is meant: this reads the *initial* count to seed the
	// list, and every count after it arrives through `reconcile` below — which is
	// the only path that can tell an added step from one that was always there.
	const animator = untrack(() => new StepAnimator(count));
	let steps = $state(animator.getSteps());

	// Reconcile *before* the DOM updates. A step that has just been added has to
	// render its collapsed `.pasito-entering` state in the same flush that adds
	// it, or it flashes at full width for a frame before the transition starts.
	$effect.pre(() => {
		animator.reconcile(count);
		steps = animator.getSteps();
	});

	const hasEntering = $derived(steps.some((s) => s.phase === 'entering'));
	const exitingCount = $derived(steps.filter((s) => s.phase === 'exiting').length);

	// Two frames, not one: the first only guarantees the collapsed state is in
	// the DOM, the second that the browser has painted it. Promoting after one
	// frame lands both states in the same paint and there is nothing to animate.
	$effect(() => {
		if (!hasEntering) return;
		let second;
		const first = requestAnimationFrame(() => {
			second = requestAnimationFrame(() => {
				animator.promoteEntering();
				steps = animator.getSteps();
			});
		});
		return () => {
			cancelAnimationFrame(first);
			cancelAnimationFrame(second);
		};
	});

	// Exiting steps collapse to width 0 and margin 0 first, so removing them
	// from the DOM afterwards shifts nothing.
	$effect(() => {
		if (exitingCount === 0) return;
		const timer = setTimeout(() => {
			animator.removeExiting();
			steps = animator.getSteps();
		}, EXIT_DURATION);
		return () => clearTimeout(timer);
	});
</script>

<div
	class="pasito-container {className}"
	class:pasito-vertical={vertical}
	role={containerRole}
	aria-label={label}
	style:--pill-duration="{transitionDuration}ms"
	style:--pill-easing={easing}
	style:width={!vertical && stepWindow.containerSize != null
		? `${stepWindow.containerSize}px`
		: undefined}
	style:height={vertical && stepWindow.containerSize != null
		? `${stepWindow.containerSize}px`
		: undefined}
>
	<div class="pasito-track" style:transform={stepWindow.transformValue}>
		{#each steps as step (step.key)}
			{@const isActive = step.index === active}
			<button
				type="button"
				class="pasito-step"
				class:pasito-step-active={isActive}
				class:pasito-step-filling={isActive && filling}
				class:pasito-entering={step.phase === 'entering'}
				class:pasito-exiting={step.phase === 'exiting'}
				style:--pill-fill-duration={isActive && filling ? `${fillDuration}ms` : undefined}
				role={stepRole}
				aria-selected={stepRole === 'tab' ? isActive : undefined}
				aria-current={stepRole === 'tab' ? undefined : isActive ? 'true' : undefined}
				aria-label={stepLabel(step.index, count)}
				tabindex={isActive ? 0 : -1}
				disabled={!onStepClick}
				onclick={() => onStepClick?.(step.index)}
			></button>
		{/each}
	</div>
</div>

<style>
	.pasito-container {
		--pill-dot-size: 8px;
		--pill-active-width: 24px;
		--pill-gap: 6px;
		--pill-duration: 500ms;
		--pill-easing: cubic-bezier(0.215, 0.61, 0.355, 1);
		--pill-bg: rgba(0, 0, 0, 0.12);
		--pill-active-bg: rgba(0, 0, 0, 0.8);
		--pill-fill-bg: rgba(255, 255, 255, 0.45);
		--pill-container-bg: rgba(0, 0, 0, 0.04);
		--pill-container-radius: 999px;
		--pill-container-border: rgba(0, 0, 0, 0.06);

		display: inline-flex;
		padding: 6px 10px;
		background: var(--pill-container-bg);
		border-radius: var(--pill-container-radius);
		border: 1px solid var(--pill-container-border);
		overflow: hidden;
		/* `computeStepWindow`'s container size counts dots and gaps only. Under a
		   border-box reset — Tailwind's, here — that width would swallow the
		   padding and clip the last dot. */
		box-sizing: content-box;
	}

	.pasito-track {
		display: flex;
		align-items: center;
		margin-left: calc(-1 * var(--pill-gap));
		transition: transform var(--pill-duration) var(--pill-easing);
	}

	.pasito-vertical .pasito-track {
		flex-direction: column;
		margin-left: 0;
		margin-top: calc(-1 * var(--pill-gap));
	}

	.pasito-step {
		position: relative;
		width: var(--pill-dot-size);
		height: var(--pill-dot-size);
		border-radius: 999px;
		border: none;
		padding: 0;
		cursor: pointer;
		background: var(--pill-bg);
		flex-shrink: 0;
		overflow: hidden;
		margin-left: var(--pill-gap);
		margin-top: 0;
		transform-origin: center center;
		transition:
			width var(--pill-duration) var(--pill-easing),
			height var(--pill-duration) var(--pill-easing),
			background var(--pill-duration) var(--pill-easing),
			opacity var(--pill-duration) var(--pill-easing),
			transform var(--pill-duration) var(--pill-easing),
			margin-left var(--pill-duration) var(--pill-easing),
			margin-top var(--pill-duration) var(--pill-easing);
	}

	.pasito-step:disabled {
		cursor: default;
	}

	.pasito-vertical .pasito-step {
		margin-left: 0;
		margin-top: var(--pill-gap);
	}

	.pasito-step:focus-visible {
		outline: 2px solid var(--pill-focus-ring, rgba(0, 0, 0, 0.3));
		outline-offset: 2px;
	}

	.pasito-step-active {
		width: var(--pill-active-width);
		background: var(--pill-active-bg);
	}

	.pasito-vertical .pasito-step-active {
		width: var(--pill-dot-size);
		height: var(--pill-active-width);
	}

	/* Fill progress bar */
	.pasito-step::after {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		bottom: 0;
		width: 0;
		border-radius: inherit;
		background: var(--pill-fill-bg);
		pointer-events: none;
	}

	.pasito-vertical .pasito-step::after {
		right: 0;
		bottom: auto;
		width: auto;
		height: 0;
	}

	.pasito-step-filling::after {
		width: 100%;
		transition: width var(--pill-fill-duration, 3000ms) linear;
	}

	.pasito-vertical .pasito-step-filling::after {
		width: auto;
		height: 100%;
		transition: height var(--pill-fill-duration, 3000ms) linear;
	}

	/* Enter: the collapsed state a new step renders at. Once it has painted,
	   the class comes off and the transitions above animate it open. */
	.pasito-entering {
		width: 0;
		margin-left: 0;
		margin-top: 0;
		opacity: 0;
		transform: scale(0);
		transition-duration: 250ms;
	}

	.pasito-vertical .pasito-entering {
		width: var(--pill-dot-size);
		height: 0;
	}

	/* Exit: the same state, transitioned back into. Width and margin are both
	   zero by the time the node is removed, so removal costs no layout shift. */
	.pasito-exiting {
		width: 0;
		margin-left: 0;
		margin-top: 0;
		opacity: 0;
		transform: scale(0);
		transition-duration: 250ms;
	}

	.pasito-vertical .pasito-exiting {
		width: var(--pill-dot-size);
		height: 0;
	}

	@media (prefers-reduced-motion: reduce) {
		.pasito-step,
		.pasito-track {
			transition-duration: 0ms !important;
		}
		.pasito-step-filling::after {
			transition-duration: 0ms !important;
		}
	}
</style>
