<!--
	A run of images in an article, as one swipeable strip with a pasito stepper
	under it instead of a column of full-width photos.

	The strip is a plain scroll-snap container, so it works with no JS at all:
	the images are there, in order, and can be scrolled. Everything the script
	adds — the stepper, tapping a dot to jump, the arrows — is on top of that.

	`data-lightbox-group` is what ties it to the lightbox: `lightboxAction` sees
	it on the click path and opens the whole strip as a group rather than the one
	image, which is what puts the same stepper on the lightbox's own chrome.
-->
<script>
	import Stepper from '$lib/pasito/Stepper.svelte';

	let {
		/** @type {Array<{ src: string, alt?: string, title?: string }>} */
		images = [],
		/**
		 * Height of the strip. Every slide is the same height on purpose — a
		 * strip that resized per image would jump as it snapped between them —
		 * and it is a prop so a hand-written gallery of short images doesn't have
		 * to sit in a tall box.
		 */
		height = 'clamp(220px, 52vw, 460px)',
		class: className = ''
	} = $props();

	let trackEl = $state(null);
	let active = $state(0);
	/** The scroll strip only earns its arrows once it is actually scrollable. */
	let overflowing = $state(false);

	const multiple = $derived(images.length > 1);
	const caption = $derived(images[active]?.title || images[active]?.alt || '');

	let scrollFrame = 0;
	let settleTimer;
	/** Announced only once the strip has stopped — not on every frame of a swipe. */
	let announced = $state('');

	/**
	 * Which slide is nearest the middle of the viewport. Reading scroll position
	 * rather than an IntersectionObserver keeps the dot in step during the swipe
	 * itself, not only once the snap has settled.
	 */
	function syncActive() {
		if (!trackEl) return;
		const slides = trackEl.children;
		if (!slides.length) return;
		const centre = trackEl.scrollLeft + trackEl.clientWidth / 2;
		let nearest = 0;
		let best = Infinity;
		for (let i = 0; i < slides.length; i++) {
			const slide = slides[i];
			const distance = Math.abs(slide.offsetLeft + slide.offsetWidth / 2 - centre);
			if (distance < best) {
				best = distance;
				nearest = i;
			}
		}
		active = nearest;
		overflowing = trackEl.scrollWidth - trackEl.clientWidth > 1;
	}

	function onScroll() {
		if (!scrollFrame) {
			scrollFrame = requestAnimationFrame(() => {
				scrollFrame = 0;
				syncActive();
			});
		}
		clearTimeout(settleTimer);
		settleTimer = setTimeout(settle, 140);
	}

	function settle() {
		if (!multiple) return;
		announced = `Image ${active + 1} of ${images.length}${caption ? `: ${caption}` : ''}`;
	}

	const reduceMotion = () =>
		typeof window !== 'undefined' &&
		window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

	function goTo(i) {
		const clamped = Math.max(0, Math.min(i, images.length - 1));
		const slide = trackEl?.children[clamped];
		if (!slide) return;
		trackEl.scrollTo({
			left: slide.offsetLeft - (trackEl.clientWidth - slide.offsetWidth) / 2,
			behavior: reduceMotion() ? 'auto' : 'smooth'
		});
	}

	/**
	 * A scroll container already answers the arrow keys, but it answers them by
	 * scrolling a fixed number of pixels — which lands between two snap points
	 * and leaves the stepper mid-way. Stepping a whole slide is what the dots
	 * say the arrows do.
	 */
	function onKeydown(e) {
		if (e.metaKey || e.ctrlKey || e.altKey) return;
		const jump = { ArrowRight: active + 1, ArrowLeft: active - 1, Home: 0, End: images.length - 1 };
		if (!(e.key in jump)) return;
		e.preventDefault();
		goTo(jump[e.key]);
	}

	// A swipe ends in a click, and the click would open the lightbox on whatever
	// the finger happened to lift over. Only a press that stayed still is a tap.
	let pressX = 0;
	let pressY = 0;

	function onPointerDown(e) {
		pressX = e.clientX;
		pressY = e.clientY;
	}

	function onClick(e) {
		if (Math.hypot(e.clientX - pressX, e.clientY - pressY) <= 10) return;
		// `lightboxAction` listens on an ancestor, so stopping here is enough.
		e.stopPropagation();
		e.preventDefault();
	}

	$effect(() => {
		syncActive();
		return () => {
			cancelAnimationFrame(scrollFrame);
			clearTimeout(settleTimer);
		};
	});
</script>

<figure class="gallery {className}" style="--gallery-height: {height}">
	<div class="gallery-frame">
		<!-- A scroll container is keyboard-operable, so it has to be reachable by tab
		     for the arrow keys to be able to reach it — and the handlers here refine
		     scrolling it already does, rather than inventing a control. -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			class="gallery-track"
			bind:this={trackEl}
			onscroll={onScroll}
			onkeydown={onKeydown}
			onpointerdown={onPointerDown}
			onclickcapture={onClick}
			data-lightbox-group
			tabindex="0"
			role="group"
			aria-label="Image gallery, {images.length} images"
			aria-roledescription="carousel"
		>
			{#each images as image, i (image.src + i)}
				<div class="gallery-slide">
					<img
						src={image.src}
						alt={image.alt ?? ''}
						loading="lazy"
						decoding="async"
						draggable="false"
					/>
				</div>
			{/each}
		</div>

		{#if multiple}
			<button
				type="button"
				class="gallery-arrow gallery-prev"
				onclick={() => goTo(active - 1)}
				disabled={active === 0 || !overflowing}
				aria-label="Previous image"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<polyline points="15 18 9 12 15 6" />
				</svg>
			</button>
			<button
				type="button"
				class="gallery-arrow gallery-next"
				onclick={() => goTo(active + 1)}
				disabled={active === images.length - 1 || !overflowing}
				aria-label="Next image"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<polyline points="9 18 15 12 9 6" />
				</svg>
			</button>
		{/if}
	</div>

	{#if multiple}
		<div class="gallery-steps">
			<Stepper
				count={images.length}
				{active}
				onStepClick={goTo}
				maxVisible={9}
				class="gallery-stepper"
				label="Gallery position"
				containerRole="group"
				stepRole="button"
				stepLabel={(i, total) => `Go to image ${i + 1} of ${total}`}
			/>
		</div>
	{/if}

	<!-- Spoken separately from the caption below, and only once the strip has
	     stopped: the visible one changes on every frame of a swipe, and a live
	     region doing the same would talk over itself. -->
	<p class="gallery-live" aria-live="polite">{announced}</p>

	<!-- Held open at one line so paging between a captioned and an uncaptioned
	     image doesn't shunt the rest of the article up and down. -->
	<figcaption class="gallery-caption">{caption}</figcaption>
</figure>

<style>
	.gallery {
		margin: 2rem 0;
		/* The caption reads first and the dots sit under it, the same order the
		   lightbox uses. `order` rather than DOM order because `<figcaption>` is
		   only valid as a figure's first or last child — and nothing between the
		   two is focusable, so tab order is unaffected. */
		display: flex;
		flex-direction: column;
	}

	.gallery-frame {
		order: 0;
		position: relative;
	}

	.gallery-caption {
		order: 1;
		min-height: 1.5em;
		margin-top: 0.625rem;
		text-align: center;
		font-size: 0.875rem;
		line-height: 1.5;
		color: rgb(115 115 115);
	}

	.gallery-steps {
		order: 2;
		display: flex;
		justify-content: center;
		margin-top: 0.5rem;
	}

	.gallery-live {
		order: 3;
	}

	.gallery-track {
		position: relative;
		display: flex;
		gap: 0.75rem;
		overflow-x: auto;
		overscroll-behavior-x: contain;
		scroll-snap-type: x mandatory;
		scrollbar-width: none;
		-webkit-overflow-scrolling: touch;
		border-radius: 0.5rem;
	}

	.gallery-track::-webkit-scrollbar {
		display: none;
	}

	.gallery-track:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: 3px;
	}

	.gallery-slide {
		flex: 0 0 100%;
		/* The height is on the slide, not the image: every slide has to be the
		   same size or the strip would jump as it snaps between them. */
		height: var(--gallery-height, clamp(220px, 52vw, 460px));
		scroll-snap-align: center;
		scroll-snap-stop: always;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.04);
		border-radius: 0.5rem;
		overflow: hidden;
	}

	:global(.dark) .gallery-slide {
		background: rgba(255, 255, 255, 0.05);
	}

	.gallery-slide img {
		/* Shrink to fit, never stretch to fill. Plenty of the images in these
		   posts are a few hundred pixels wide, and the lightbox already refuses
		   to upscale them — a gallery that blew them up would make opening one
		   look like it had shrunk. */
		max-width: 100%;
		max-height: 100%;
		width: auto;
		height: auto;
		object-fit: contain;
		margin: 0;
		cursor: zoom-in;
		user-select: none;
		-webkit-user-drag: none;
	}

	.gallery-arrow {
		position: absolute;
		top: 50%;
		width: 2rem;
		height: 2rem;
		margin-top: -1rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		border-radius: 9999px;
		background: rgba(255, 255, 255, 0.82);
		color: rgb(23 23 23);
		box-shadow: 0 1px 6px rgba(0, 0, 0, 0.2);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		cursor: pointer;
		/* Present for a pointer, invisible until it is over the strip — an arrow
		   parked on the photo the whole time is one more thing covering it. */
		opacity: 0;
		transition:
			opacity 0.18s ease,
			transform 0.18s ease,
			background-color 0.18s ease;
	}

	.gallery-arrow svg {
		width: 1rem;
		height: 1rem;
	}

	.gallery-prev {
		left: 0.5rem;
	}

	.gallery-next {
		right: 0.5rem;
	}

	.gallery-frame:hover .gallery-arrow,
	.gallery-arrow:focus-visible {
		opacity: 1;
	}

	.gallery-arrow:hover:not(:disabled) {
		background: rgb(255 255 255);
		transform: scale(1.06);
	}

	.gallery-arrow:disabled {
		opacity: 0;
		pointer-events: none;
	}

	:global(.dark) .gallery-arrow {
		background: rgba(23, 23, 23, 0.82);
		color: rgb(245 245 245);
	}

	:global(.dark) .gallery-arrow:hover:not(:disabled) {
		background: rgb(23 23 23);
	}

	/* No hover to reveal them on touch, and the swipe already does the job. */
	@media (pointer: coarse) {
		.gallery-arrow {
			display: none;
		}
	}

	.gallery-steps :global(.gallery-stepper) {
		--pill-bg: rgba(0, 0, 0, 0.16);
		--pill-active-bg: rgba(0, 0, 0, 0.75);
	}

	:global(.dark) .gallery-steps :global(.gallery-stepper) {
		--pill-bg: rgba(255, 255, 255, 0.22);
		--pill-active-bg: rgba(255, 255, 255, 0.85);
		--pill-container-bg: rgba(255, 255, 255, 0.06);
		--pill-container-border: rgba(255, 255, 255, 0.1);
		--pill-focus-ring: rgba(255, 255, 255, 0.5);
	}

	:global(.dark) .gallery-caption {
		color: rgb(163 163 163);
	}

	.gallery-live {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
		border: 0;
	}

	@media (prefers-reduced-motion: reduce) {
		.gallery-track {
			scroll-behavior: auto;
		}
	}
</style>
