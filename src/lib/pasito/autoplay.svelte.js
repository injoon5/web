import { AutoPlayController } from './core.js';

/**
 * pasito's `useAutoPlay`, as a Svelte 5 rune factory.
 *
 * React and Vue take the reactive inputs as values and refs respectively; the
 * Svelte shape is a getter, so `count` and `active` stay live without the
 * caller having to thread a store through.
 *
 * Must be called during component initialisation — it owns effects.
 *
 * @param {() => {
 *   count: number,
 *   active: number,
 *   onStepChange: (index: number) => void,
 *   stepDuration?: number,
 *   loop?: boolean,
 *   enabled?: boolean
 * }} options
 * @returns {{ readonly playing: boolean, toggle: () => void, readonly filling: boolean, readonly fillDuration: number }}
 */
export function createAutoPlay(options) {
	const opts = $derived({ stepDuration: 3000, loop: true, enabled: true, ...options() });

	let playing = $state(false);
	const controller = new AutoPlayController();

	$effect(() => {
		controller.stepDuration = opts.stepDuration;
		controller.loop = opts.loop;
	});

	// Being switched off stops playback rather than pausing it, so re-enabling
	// doesn't silently resume something the visitor never started.
	$effect(() => {
		if (!opts.enabled) playing = false;
	});

	// Reading `active` here is the point: each advance re-runs this effect, which
	// clears the old timer and schedules the next step a full duration later.
	$effect(() => {
		if (!playing || !opts.enabled) return;
		const timer = setTimeout(() => {
			const next = controller.computeNext(opts.active, opts.count);
			if (next !== null) opts.onStepChange(next);
			else playing = false;
		}, opts.stepDuration);
		return () => clearTimeout(timer);
	});

	const isActive = $derived(playing && opts.enabled);

	return {
		get playing() {
			return isActive;
		},
		toggle() {
			playing = !playing;
		},
		get filling() {
			return isActive;
		},
		get fillDuration() {
			return opts.stepDuration;
		}
	};
}
