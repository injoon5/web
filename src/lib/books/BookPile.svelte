<script>
	/**
	 * A pile of books, most recent on top, resting on the page.
	 *
	 * The pile is its own container so every book inside is sized in `cqw` —
	 * the whole object scales as one thing from a phone to a wide column
	 * without a single breakpoint.
	 */
	import BookVolume from './BookVolume.svelte';
	import { clothFor, isPaleCloth, pileGeometry } from './bookStyle.js';

	let { books = [], onenter, onleave } = $props();

	// Incoming order is newest first; a pile is built from the bottom up, so
	// the newest book ends up on top where you would have put it.
	let laid = $derived.by(() => {
		const bottomUp = [...books].reverse();
		const geoms = pileGeometry(bottomUp);
		let previous;
		return bottomUp.map((book, i) => {
			const cloth = clothFor(book, previous);
			previous = cloth.name;
			return { book, cloth, pale: isPaleCloth(cloth), geom: geoms[i] };
		});
	});
</script>

<div class="pile">
	<!-- First in the DOM so it paints under the books; `column-reverse` puts it
	     at the foot of the pile. -->
	<div class="ground" aria-hidden="true"></div>
	{#each laid as item, i (item.book.slug)}
		<BookVolume
			book={item.book}
			cloth={item.cloth}
			pale={item.pale}
			geom={item.geom}
			top={i === laid.length - 1}
			depth={laid.length > 1 ? i / (laid.length - 1) : 1}
			{onenter}
			{onleave}
		/>
	{/each}
</div>

<style>
	/* Built bottom-up: the first book in the DOM is the one on the floor, and
	   every later book paints over it — which is how the upper books get to
	   cast their shadows onto the lower ones. */
	.pile {
		container-type: inline-size;
		display: flex;
		flex-direction: column-reverse;
		align-items: center;
		width: 100%;
		/* One viewpoint, slightly above the pile and in front of it. Every book
		   is flat and level; the only thing that varies is how far each one is
		   turned, and this is what turns that into what you actually see —
		   the near end of a turned spine taller, the far end shorter and
		   riding up. Tight enough to read, far enough not to fish-eye. */
		perspective: 900px;
		perspective-origin: 50% 45%;
		/* Big enough to read a spine across the room, small enough that a book
		   still looks like a book and not a plank. */
		max-width: 30rem;
	}

	/* ── Making room ──────────────────────────────────────────────────
	   Reaching for a book opens the pile around it: everything above rises,
	   everything under it settles. Sibling selectors mean the pile never has
	   to track which book the pointer is on — and since the pile is laid out
	   column-reverse, a *later* sibling is a book *higher up*. */
	@media (hover: hover) {
		.pile :global(.vol:hover ~ .vol) {
			--lift: -6cqw;
		}

		.pile :global(.vol:has(~ .vol:hover)) {
			--lift: 3cqw;
		}
	}

	.pile :global(.vol:focus-visible ~ .vol) {
		--lift: -6cqw;
	}

	.pile :global(.vol:has(~ .vol:focus-visible)) {
		--lift: 3cqw;
	}

	@media (prefers-reduced-motion: reduce) {
		.pile :global(.vol:hover ~ .vol),
		.pile :global(.vol:has(~ .vol:hover)),
		.pile :global(.vol:focus-visible ~ .vol),
		.pile :global(.vol:has(~ .vol:focus-visible)) {
			--lift: 0px;
		}
	}

	/* What the pile is standing on. Without it the stack floats. */
	.ground {
		width: 96%;
		height: 16px;
		margin-top: -3px;
		background: radial-gradient(60% 50% at 50% 0%, rgb(0 0 0 / 0.3), rgb(0 0 0 / 0) 72%);
		filter: blur(1px);
	}

	/* ── Dark ─────────────────────────────────────────────────────────
	   You cannot draw a shadow darker than a near-black page, so the floor
	   becomes a lit surface instead of a dark one, the books get a rim
	   rather than an inset black outline to hold their silhouette, and the
	   pale cloths come down: `cream` on black is otherwise the brightest
	   thing in the viewport, brighter than the heading. */
	:global(.dark) .ground {
		background: linear-gradient(180deg, rgb(255 255 255 / 0.05), rgb(255 255 255 / 0) 65%);
		filter: none;
	}

	:global(.dark) .pile :global(.vol) {
		box-shadow:
			inset 0 0 0 1px rgb(255 255 255 / 0.07),
			0 2px 3px -1px rgb(0 0 0 / 0.8),
			0 16px 22px -12px rgb(0 0 0 / 0.6);
	}

	:global(.dark) .pile {
		filter: brightness(0.76) saturate(0.88);
	}
</style>
