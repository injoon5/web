<script>
	/**
	 * One book lying in a pile, seen from the spine side — the way a book
	 * actually sits when it is between the shelf and your desk.
	 *
	 * All of the realism is in the surface: a cylindrical roll of light down
	 * the spine, cloth weave, the joint grooves where the boards are hinged,
	 * caps at both ends, and foil rules stamped along the length. Hovering
	 * slides it out of the pile rather than lifting it, because that is the
	 * only direction a book in a stack can actually go.
	 */
	import { spineAuthor } from './bookStyle.js';

	let { book, cloth, pale = false, geom, top = false, depth = 1, onenter, onleave } = $props();

	let author = $derived(spineAuthor(book.author));
</script>

<a
	href="/books/{book.slug}"
	class="vol"
	class:pale
	style:--base={cloth.base}
	style:--foil={cloth.foil}
	style:--t="{geom.thickness}cqw"
	style:--w="{geom.width}%"
	style:--w-n={geom.width}
	style:--dx="{geom.shift}px"
	style:--yaw="{geom.yaw}deg"
	style:--yaw-n={geom.yaw}
	style:--depth={depth}
	aria-label="{book.title}{book.author ? ` by ${book.author}` : ''}{book.reading
		? ' — currently reading'
		: ''}"
	onmouseenter={() => onenter?.(book)}
	onmouseleave={() => onleave?.(book)}
	onfocus={() => onenter?.(book)}
	onblur={() => onleave?.(book)}
>
	{#if top}
		<!-- The board of the book on top, foreshortened. The one surface of a
		     pile you can actually see. -->
		<span class="lid" aria-hidden="true">
			{#if book.cover}
				<img src={book.cover} alt="" loading="lazy" decoding="async" />
			{/if}
		</span>
	{/if}
	{#if book.spine}
		<img class="art" src={book.spine} alt="" loading="lazy" decoding="async" />
	{/if}
	<span class="face" aria-hidden="true"></span>
	<span class="joint start" aria-hidden="true"></span>
	<span class="joint end" aria-hidden="true"></span>
	{#if !book.spine}
		<span class="type" aria-hidden="true">
			<span class="line">
				<span class="title">{book.title}</span>
				{#if author}<span class="author">{author}</span>{/if}
			</span>
		</span>
	{/if}
</a>

<style>
	.vol {
		/* Set by the hover rules below: how far this book slides out, how far
		   the pile opens around it, and how much nearer it comes. */
		--pull: 0px;
		--lift: 0px;
		--grow: 1;

		position: relative;
		display: block;
		width: var(--w);
		height: var(--t);
		/* A pamphlet is still a book you have to read the spine of and hit with
		   a cursor. The upper bound lives in `pileGeometry`, where it can stay
		   monotonic in the page count instead of flattening against a ceiling. */
		min-height: 26px;
		/* Books in a pile touch, and then some — a bright notch of page showing
		   between two of them is the fastest way to break a stack. */
		margin-top: -5px;
		border-radius: 2px;
		background: var(--base);
		color: var(--foil);
		/* The turn is the only rotation. Everything the eye reads as a skew —
		   the near end taller, the far end riding up — is the pile's
		   perspective doing its job on it. */
		transform: translate(calc(var(--dx) + var(--pull)), var(--lift)) scale(var(--grow))
			rotateY(var(--yaw));
		/* A hard contact line where it presses on the book below, then a soft
		   spread — the two shadows a stacked object actually casts. */
		box-shadow:
			inset 0 0 0 1px rgb(0 0 0 / 0.2),
			0 2px 2px -1px rgb(0 0 0 / 0.5),
			0 4px 6px -2px rgb(0 0 0 / 0.35),
			0 16px 22px -12px rgb(0 0 0 / 0.3);
		/* Lower books sit in the pile's own shadow. */
		filter: brightness(calc(1 - 0.14 * (1 - var(--depth, 1))));
		/* Transform only: the shadow under a book is large and blurred, and
		   animating it repaints the whole pile for four hundred milliseconds. */
		transition: transform 400ms var(--ease-out-soft);
		-webkit-tap-highlight-color: transparent;
	}

	.pale {
		box-shadow:
			inset 0 0 0 1px rgb(0 0 0 / 0.13),
			0 2px 2px -1px rgb(0 0 0 / 0.4),
			0 4px 6px -2px rgb(0 0 0 / 0.28),
			0 16px 22px -12px rgb(0 0 0 / 0.26);
	}

	/* ── Top board ────────────────────────────────────────────────────
	   Clipped to a shallow trapezoid so it reads as a surface running away
	   from the eye rather than a second spine. */
	.lid {
		position: absolute;
		left: 0;
		right: 0;
		bottom: calc(100% - 2px);
		/* A board is a big surface seen down a long lens: deep, and barely
		   tapered. A steep taper over a shallow run draws a gable roof, which
		   is the one thing that stops a pile reading as books. The taper is
		   skewed by the book's own turn, because a turned board has one near
		   corner and one far one. */
		height: 8cqw;
		overflow: hidden;
		border-radius: 2px 2px 0 0;
		background: var(--base);
		clip-path: polygon(
			calc(3.5% + var(--yaw-n) * 0.3%) 0,
			calc(96.5% + var(--yaw-n) * 0.3%) 0,
			100% 100%,
			0 100%
		);
		/* The seam where the board meets the spine. */
		box-shadow: inset 0 -1px 0 rgb(0 0 0 / 0.4);
	}

	.lid img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: 50% 35%;
	}

	.lid::after {
		content: '';
		position: absolute;
		inset: 0;
		background:
			repeating-linear-gradient(90deg, rgb(255 255 255 / 0.03) 0 1px, rgb(0 0 0 / 0.03) 1px 3px),
			linear-gradient(
				180deg,
				rgb(255 255 255 / 0.16) 0%,
				rgb(255 255 255 / 0.04) 35%,
				rgb(0 0 0 / 0.1) 72%,
				rgb(0 0 0 / 0.34) 100%
			);
	}

	.art {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: inherit;
	}

	/* ── Spine surface ────────────────────────────────────────────────
	   Caps at both ends, cloth weave, and the roll of light that turns a
	   rectangle into something round. */
	.face {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		pointer-events: none;
		background:
			linear-gradient(90deg, rgb(255 255 255 / 0.09) 0 2.5%, rgb(255 255 255 / 0) 3.2%),
			linear-gradient(270deg, rgb(255 255 255 / 0.09) 0 2.5%, rgb(255 255 255 / 0) 3.2%),
			repeating-linear-gradient(90deg, rgb(255 255 255 / 0.022) 0 1px, rgb(0 0 0 / 0.022) 1px 3px),
			linear-gradient(
				180deg,
				rgb(0 0 0 / 0.44) 0%,
				rgb(0 0 0 / 0.08) 7%,
				rgb(255 255 255 / 0.18) 24%,
				rgb(255 255 255 / 0.04) 50%,
				rgb(0 0 0 / 0.05) 70%,
				rgb(0 0 0 / 0.26) 92%,
				rgb(0 0 0 / 0.5) 100%
			);
	}

	/* The hinge grooves where the boards meet the spine. */
	.joint {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 3px;
		pointer-events: none;
		background: linear-gradient(90deg, rgb(0 0 0 / 0.3) 0%, rgb(255 255 255 / 0.09) 100%);
		opacity: 0.75;
	}

	.joint.start {
		left: 4.2%;
	}

	.joint.end {
		right: 4.2%;
		transform: scaleX(-1);
	}

	/* ── Stamped type ─────────────────────────────────────────────────
	   Title at the head, author at the tail, foil rules top and bottom. */
	.type {
		position: absolute;
		inset: 0;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 8.5%;
		overflow: hidden;
	}

	/* Title and author share a baseline, and the pair is centred as one thing.
	   Pinning the author to the far end is what made a spine read as a table
	   row — nothing on a real spine is set against the opposite margin. */
	.line {
		display: flex;
		align-items: baseline;
		gap: 1.1em;
		min-width: 0;
		max-width: 100%;
	}

	.type::before,
	.type::after {
		content: '';
		position: absolute;
		left: 21%;
		right: 21%;
		height: 1px;
		background: currentColor;
		opacity: 0.3;
	}

	.type::before {
		top: 15%;
	}

	.type::after {
		bottom: 15%;
	}

	.title,
	.author {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		text-shadow: 0 1px 0 rgb(0 0 0 / 0.25);
	}

	.pale .title,
	.pale .author {
		text-shadow: 0 1px 0 rgb(255 255 255 / 0.4);
	}

	.title {
		font-size: clamp(12px, 3.2cqw, 17px);
		font-weight: 500;
		letter-spacing: -0.006em;
		flex: 0 1 auto;
	}

	.author {
		font-size: clamp(8.5px, 2.2cqw, 10.5px);
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		opacity: 0.66;
		/* The title gives way first — an author's name half-printed looks like
		   a mistake in a way a clipped title does not. */
		flex: none;
		max-width: 38%;
	}

	/* ── Taking one out of the pile ───────────────────────────────────
	   The book slides out sideways — the only direction it can go — and comes
	   a little nearer. Making the rest of the pile move out of its way is the
	   pile's job, so those rules live in BookPile. */
	@media (hover: hover) {
		.vol:hover {
			--pull: calc(4cqw + var(--w-n) * 0.025 * 1cqw);
			--grow: 1.05;
			z-index: 5;
			box-shadow:
				inset 0 0 0 1px rgb(0 0 0 / 0.2),
				-8px 14px 24px -10px rgb(0 0 0 / 0.55);
		}
	}

	.vol:focus-visible {
		--pull: calc(4cqw + var(--w-n) * 0.025 * 1cqw);
		--grow: 1.05;
		outline: none;
		z-index: 5;
		box-shadow:
			inset 0 0 0 1px rgb(0 0 0 / 0.2),
			0 0 0 2px var(--color-neutral-900),
			-8px 14px 24px -10px rgb(0 0 0 / 0.55);
	}

	:global(.dark) .vol:focus-visible {
		box-shadow:
			inset 0 0 0 1px rgb(0 0 0 / 0.2),
			0 0 0 2px var(--color-neutral-100),
			-8px 14px 24px -10px rgb(0 0 0 / 0.55);
	}

	/* Reaching for a book should still show you which one you are on, but it
	   does not have to move to say so. */
	@media (prefers-reduced-motion: reduce) {
		.vol {
			transition: none;
		}

		.vol:hover,
		.vol:focus-visible {
			--pull: 0px;
			--grow: 1;
		}
	}
</style>
