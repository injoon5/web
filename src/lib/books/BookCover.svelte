<script>
	/**
	 * The hero object on a book page: the same book as on the shelf, turned to
	 * face the reader, with its spine still catching the light on the left.
	 */
	import { clothFor, isPaleCloth, spineThickness, spineAuthor } from './bookStyle.js';

	let { book, height = 300 } = $props();

	let cloth = $derived(clothFor(book));
	let author = $derived(spineAuthor(book.author));
	let pale = $derived(isPaleCloth(cloth));
	let width = $derived(Math.round(height * 0.66));
	let depth = $derived(Math.round(spineThickness(book) * 0.9));
</script>

<div
	class="book3d"
	class:pale
	style:--base={cloth.base}
	style:--foil={cloth.foil}
	style:--w="{width}px"
	style:--h="{height}px"
	style:--d="{depth}px"
>
	<div class="body">
		<div class="spine">
			<span class="spine-face" aria-hidden="true"></span>
			<span class="joint head" aria-hidden="true"></span>
			<span class="joint tail" aria-hidden="true"></span>
			<span class="spine-type">
				<span class="spine-title">{book.title}</span>
				{#if author}<span class="spine-author">{author}</span>{/if}
			</span>
		</div>
		<div class="front">
			{#if book.cover}
				<!-- Decorative: the title and author are set as text alongside it.
				     Eager — it is the largest thing on the page. -->
				<img src={book.cover} alt="" decoding="async" {width} {height} />
			{:else}
				<div class="plate">
					<span class="plate-title">{book.title}</span>
					{#if book.author}<span class="plate-author">{book.author}</span>{/if}
				</div>
			{/if}
			<span class="gloss" aria-hidden="true"></span>
		</div>
	</div>
	<div class="floor" aria-hidden="true"></div>
</div>

<style>
	.book3d {
		position: relative;
		width: calc(var(--w) + var(--d));
		height: var(--h);
		perspective: 1600px;
		flex: none;
	}

	.body {
		position: relative;
		width: var(--w);
		height: var(--h);
		margin-left: var(--d);
		transform-style: preserve-3d;
		/* Turned just far enough to read as an object, not far enough to make
		   the cover artwork hard to look at. */
		transform: rotateY(19deg) rotateX(-1.5deg);
	}

	.front {
		position: absolute;
		inset: 0;
		overflow: hidden;
		border-radius: 1px 3px 3px 1px;
		background: var(--base);
		color: var(--foil);
		box-shadow:
			inset 0 0 0 1px rgb(0 0 0 / 0.18),
			28px 26px 40px -22px rgb(0 0 0 / 0.6);
	}

	.front img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	/* Light raking across the boards, plus the darker gutter next to the spine
	   where a real cover curves away. */
	.gloss {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background:
			linear-gradient(
				90deg,
				rgb(0 0 0 / 0.3) 0%,
				rgb(0 0 0 / 0.1) 3%,
				rgb(255 255 255 / 0.14) 9%,
				rgb(255 255 255 / 0.03) 40%,
				rgb(0 0 0 / 0.02) 75%,
				rgb(0 0 0 / 0.1) 100%
			),
			repeating-linear-gradient(90deg, rgb(255 255 255 / 0.03) 0 1px, rgb(0 0 0 / 0.03) 1px 2px);
	}

	.plate {
		position: absolute;
		inset: 22px 24px;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 20px 18px 16px;
		border: 1px solid color-mix(in srgb, var(--foil) 40%, transparent);
	}

	.plate-title {
		font-size: 20px;
		font-weight: 600;
		line-height: 1.2;
		letter-spacing: -0.015em;
		text-wrap: balance;
		text-shadow: 0 1px 0 rgb(0 0 0 / 0.2);
	}

	.pale .plate-title,
	.pale .plate-author,
	.pale .spine-title,
	.pale .spine-author {
		text-shadow: 0 1px 0 rgb(255 255 255 / 0.35);
	}

	.plate-author {
		font-size: 11px;
		font-weight: 500;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		opacity: 0.72;
	}

	/* Hinged on the cover's left edge, folded back into the page. */
	.spine {
		position: absolute;
		top: 0;
		right: 100%;
		width: var(--d);
		height: 100%;
		transform-origin: right center;
		transform: rotateY(-90deg);
		background: var(--base);
		color: var(--foil);
		border-radius: 3px 0 0 3px;
		overflow: hidden;
	}

	/* The same surface as a book in a pile, turned a quarter turn: caps at both
	   ends, cloth weave, and the roll of light that makes a flat rectangle read
	   as something round. It is the same object, so it gets the same treatment. */
	.spine-face {
		position: absolute;
		inset: 0;
		background:
			linear-gradient(180deg, rgb(255 255 255 / 0.09) 0 2.5%, rgb(255 255 255 / 0) 3.2%),
			linear-gradient(0deg, rgb(255 255 255 / 0.09) 0 2.5%, rgb(255 255 255 / 0) 3.2%),
			repeating-linear-gradient(90deg, rgb(255 255 255 / 0.04) 0 1px, rgb(0 0 0 / 0.04) 1px 2px),
			repeating-linear-gradient(0deg, rgb(255 255 255 / 0.03) 0 1px, rgb(0 0 0 / 0.03) 1px 3px),
			linear-gradient(
				90deg,
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
		left: 0;
		right: 0;
		height: 3px;
		background: linear-gradient(180deg, rgb(0 0 0 / 0.3) 0%, rgb(255 255 255 / 0.09) 100%);
		opacity: 0.75;
	}

	.joint.head {
		top: 4.2%;
	}

	.joint.tail {
		bottom: 4.2%;
		transform: scaleY(-1);
	}

	.spine-type {
		position: absolute;
		inset: 0;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: space-between;
		writing-mode: vertical-rl;
		padding: 8.5% 0;
		overflow: hidden;
	}

	/* Foil rules along the length, same as the stamped rules in a pile. */
	.spine-type::before,
	.spine-type::after {
		content: '';
		position: absolute;
		top: 7%;
		bottom: 7%;
		width: 1px;
		background: currentColor;
		opacity: 0.3;
	}

	.spine-type::before {
		left: 17%;
	}

	.spine-type::after {
		right: 17%;
	}

	.spine-title,
	.spine-author {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		text-shadow: 0 1px 0 rgb(0 0 0 / 0.25);
	}

	.spine-title {
		font-size: 11px;
		font-weight: 500;
		letter-spacing: -0.006em;
		flex: 0 1 auto;
	}

	.spine-author {
		font-size: 8.5px;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		opacity: 0.66;
		flex: none;
		max-width: 38%;
	}

	/* The book is standing on something, so it owes the page a shadow —
	   tucked under the boards and thrown the same way as the light. */
	.floor {
		position: absolute;
		left: 12%;
		right: 2%;
		bottom: -7px;
		height: 16px;
		background: radial-gradient(50% 50% at 46% 50%, rgb(0 0 0 / 0.34), rgb(0 0 0 / 0) 72%);
		filter: blur(3px);
	}

	:global(.dark) .floor {
		background: radial-gradient(50% 50% at 46% 50%, rgb(0 0 0 / 0.7), rgb(0 0 0 / 0) 72%);
	}
</style>
