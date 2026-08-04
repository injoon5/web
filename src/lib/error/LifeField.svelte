<script>
	import { onMount } from 'svelte';
	import { theme } from '$lib/theme.js';
	import { lifeSettings } from './error-settings.svelte.js';
	import { gridsEqual, seedField, step } from './life.js';
	import { stampText, waitForFont } from './glyph.js';

	/**
	 * The Life field behind an error page.
	 *
	 * Fixed to the viewport rather than laid out in the page, for two reasons.
	 * The site's content lives in a `max-w-6xl` column, and a background that
	 * stopped at that column would read as a card; and a fixed element is the
	 * only one whose box is the viewport itself, which is what lets the field go
	 * on running behind the footer as you scroll rather than scrolling away.
	 *
	 * Nothing here is interactive and nothing here is content. It is
	 * `aria-hidden` with no pointer events: the status code is stamped into the
	 * grid because it is beautiful, not because it is how anyone is meant to
	 * read it — the heading does that.
	 *
	 * The stamp is a loan, not a fixture. It holds for `holdMs` and then the
	 * simulation takes it apart, and `onrelease` fires on that exact frame so
	 * the page can bring the same numeral back as real type. It is never
	 * stamped again after that — a reseed a hundred seconds later would drop a
	 * numeral straight onto the heading, which by then is sitting where it used
	 * to be.
	 */

	/**
	 * `text` is the status code to stamp into the grid — empty means no stamp.
	 * `onrelease` fires once, when the stamp stops being held.
	 */
	const { text = '', onrelease } = $props();

	let canvas;
	/** Held back until the first composition is on the canvas, so the field
	    fades up rather than snapping in mid-generation. */
	let concealed = $state(true);
	/** Resolved from the element's own `color`, so dark mode carries it. */
	let fill = $state('#e5e5e5');

	$effect(() => {
		// Re-read on every theme flip. `$theme` is the dependency; the value is
		// only ever the trigger.
		void $theme;
		if (canvas) fill = getComputedStyle(canvas).color;
	});

	onMount(() => {
		const ctx = canvas.getContext('2d');
		if (!ctx) {
			// No field means no numeral to hand over, and the page should not sit
			// waiting on a beat that will never be played.
			onrelease?.();
			return;
		}

		const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

		let cols = 0;
		let rows = 0;
		let cell = 0;
		let prev = new Uint8Array(0);
		let cur = new Uint8Array(0);
		let next = new Uint8Array(0);

		let frame = 0;
		let lastTime = 0;
		let carried = 0;
		let generation = 0;
		let holdUntil = 0;
		let settledFor = 0;
		let reseeding = false;
		let disposed = false;
		/** Whether the next composition carries the numeral. True for the first
		    one only — see the note at the top of the file. */
		let stamped = !motion.matches;
		let released = false;

		/**
		 * Hand the numeral over to the page, once.
		 *
		 * Under reduced motion this happens immediately rather than after the
		 * hold: no generation will ever run, so a stamp there is not a hold, it
		 * is permanent — and a permanent numeral is one the type would have to
		 * live on top of. That field gets no stamp at all, and the page's own
		 * type is the only 404 on screen.
		 */
		function release() {
			if (released) return;
			released = true;
			stamped = false;
			onrelease?.();
		}

		/** Cell pitch in CSS px. Coarser on a phone would cost the numeral its
		    letterforms, so the breakpoint is about legibility, not performance. */
		function pitch(width) {
			return width < 640 ? lifeSettings.cellSm : lifeSettings.cell;
		}

		function measure() {
			const width = canvas.clientWidth || window.innerWidth;
			const height = canvas.clientHeight || window.innerHeight;
			// Capped: past 2 the extra pixels are invisible and the fill cost is
			// real, and this canvas is the whole viewport.
			const dpr = Math.min(window.devicePixelRatio || 1, 2);

			cell = pitch(width);
			const nextCols = Math.max(8, Math.ceil(width / cell));
			const nextRows = Math.max(8, Math.ceil(height / cell));

			canvas.width = Math.round(width * dpr);
			canvas.height = Math.round(height * dpr);
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

			return { cols: nextCols, rows: nextRows, width, height };
		}

		function allocate(nextCols, nextRows) {
			cols = nextCols;
			rows = nextRows;
			prev = new Uint8Array(cols * rows);
			cur = new Uint8Array(cols * rows);
			next = new Uint8Array(cols * rows);
		}

		/**
		 * Lay down a fresh composition: the numeral first, so its bounding box can
		 * be reserved, then the shapes around it.
		 */
		function seed(width, height) {
			const s = lifeSettings;
			const glyphs = stamped ? text : '';
			const stamp = glyphs
				? stampText(glyphs, cols, rows, {
						font: getComputedStyle(canvas).fontFamily,
						weight: 600,
						height: (height * s.stampHeight) / cell,
						maxWidth: (width * s.stampWidth) / cell,
						centerY: (height * s.stampCenter) / cell,
						tracking: s.stampTracking,
						strokeWidth: s.stampStroke,
						outline: s.stampOutline
					})
				: null;

			const reserved = stamp
				? [
						{
							x: stamp.box.x - 3,
							y: stamp.box.y - 3,
							w: stamp.box.w + 6,
							h: stamp.box.h + 6
						}
					]
				: [];

			seedField(cur, cols, rows, { reserved, density: lifeSettings.density });
			if (stamp) for (let i = 0; i < cur.length; i++) cur[i] |= stamp.mask[i];

			prev.fill(0);
			generation = 0;
			settledFor = 0;
			holdUntil = performance.now() + lifeSettings.holdMs;
		}

		function draw() {
			const s = lifeSettings;
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.globalAlpha = s.opacity;
			ctx.fillStyle = fill;

			const size = Math.max(1, cell - s.gap);
			const round = s.radius > 0 && typeof ctx.roundRect === 'function';

			// One path for the whole field rather than a fill call per cell: a busy
			// generation is a few thousand cells, and a few thousand fills is the
			// difference between this costing nothing and it costing a frame.
			ctx.beginPath();
			for (let y = 0; y < rows; y++) {
				const py = y * cell;
				const row = y * cols;
				for (let x = 0; x < cols; x++) {
					if (!cur[row + x]) continue;
					if (round) ctx.roundRect(x * cell, py, size, size, s.radius);
					else ctx.rect(x * cell, py, size, size);
				}
			}
			ctx.fill();
		}

		function reseed() {
			if (reseeding) return;
			reseeding = true;
			concealed = true;

			// Long enough for the fade-out to finish, and no longer: the field is
			// blank for exactly this window.
			setTimeout(() => {
				if (disposed) return;
				const { cols: nextCols, rows: nextRows, width, height } = measure();
				if (nextCols !== cols || nextRows !== rows) allocate(nextCols, nextRows);
				seed(width, height);
				draw();
				concealed = false;
				reseeding = false;
			}, 280);
		}

		function advance() {
			step(cur, next, cols, rows);

			// Comparing against two generations back catches both ways a field can
			// stop being interesting: a still life (equal to every generation) and a
			// period-2 oscillator. Neither will ever produce anything new again, and
			// a screen of blinkers is wallpaper.
			const settled = gridsEqual(next, prev);
			settledFor = settled ? settledFor + 1 : 0;

			const spare = prev;
			prev = cur;
			cur = next;
			next = spare;
			generation++;
		}

		function loop(time) {
			frame = requestAnimationFrame(loop);
			if (reseeding || document.hidden) {
				lastTime = time;
				return;
			}

			const stepMs = Math.max(16, lifeSettings.stepMs);
			// Clamped so a backgrounded tab doesn't come back and fast-forward
			// through a thousand generations in one frame.
			carried = Math.min(carried + (time - lastTime), stepMs * 4);
			lastTime = time;
			if (time < holdUntil) return;

			// The hold is over, so the numeral comes apart on the generation below.
			// This frame is the handoff: the page brings it back as type.
			release();
			if (carried < stepMs) return;

			while (carried >= stepMs) {
				carried -= stepMs;
				advance();
			}
			draw();

			if (settledFor >= 4 || generation >= lifeSettings.cycle) reseed();
		}

		/**
		 * A resize keeps the field it already has, rather than starting over.
		 *
		 * On a phone, scrolling shows and hides the URL bar, and every one of those
		 * is a resize. Reseeding on each would restart the composition — including
		 * the numeral, and its hold — several times on the way down the page. So
		 * the grid is reallocated and the overlapping region copied across; the
		 * gained strip fills itself in within a few generations, which is what the
		 * glider guns are for.
		 */
		function resize() {
			const { cols: nextCols, rows: nextRows, width, height } = measure();
			if (nextCols === cols && nextRows === rows) {
				draw();
				return;
			}

			const old = cur;
			const oldCols = cols;
			const oldRows = rows;
			allocate(nextCols, nextRows);

			if (old.length) {
				const copyCols = Math.min(oldCols, cols);
				const copyRows = Math.min(oldRows, rows);
				for (let y = 0; y < copyRows; y++) {
					for (let x = 0; x < copyCols; x++) cur[y * cols + x] = old[y * oldCols + x];
				}
			} else {
				seed(width, height);
			}
			draw();
		}

		const observer = new ResizeObserver(resize);

		(async () => {
			// The numeral is set in the site's typeface, which is served as a dynamic
			// subset — measuring before the digits land sizes it against the fallback
			// and it comes out at the wrong scale.
			await waitForFont(`600 100px ${getComputedStyle(canvas).fontFamily}`, text);
			if (disposed) return;

			const { cols: nextCols, rows: nextRows, width, height } = measure();
			allocate(nextCols, nextRows);
			seed(width, height);
			draw();
			concealed = false;

			observer.observe(canvas);
			if (motion.matches) {
				release();
				return;
			}

			lastTime = performance.now();
			frame = requestAnimationFrame(loop);
		})();

		// A tab that comes back should carry on, not catch up: without resetting
		// the clock the first frame back holds an hour of elapsed time.
		const onVisibility = () => {
			lastTime = performance.now();
			carried = 0;
		};
		document.addEventListener('visibilitychange', onVisibility);

		return () => {
			disposed = true;
			cancelAnimationFrame(frame);
			observer.disconnect();
			document.removeEventListener('visibilitychange', onVisibility);
		};
	});
</script>

<canvas
	bind:this={canvas}
	aria-hidden="true"
	data-concealed={concealed}
	class="pointer-events-none fixed inset-0 -z-10 h-full w-full text-neutral-200 dark:text-neutral-800"
></canvas>

<style>
	canvas {
		opacity: 1;
		/* Enter slower than it leaves: the composition arriving is worth watching,
		   the old one clearing out is just bookkeeping. */
		transition: opacity 520ms var(--ease-out-soft);
	}

	canvas[data-concealed='true'] {
		opacity: 0;
		transition-duration: 260ms;
	}
</style>
