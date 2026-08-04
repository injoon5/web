<!--
	A run of images in an article, as one swipeable strip with a pasito stepper
	under it instead of a column of full-width photos.

	The strip is a plain scroll-snap container, so it works with no JS at all:
	the images are there, in order, and can be scrolled. Everything the script
	adds — the stepper, tapping a dot to jump — is on top of that.

	`data-lightbox-group` is what ties it to the lightbox: `lightboxAction` sees
	it on the click path and opens the whole strip as a group rather than the one
	image, which is what puts the same stepper on the lightbox's own chrome.
-->
<script>
	import Stepper from '$lib/pasito/Stepper.svelte';

	let {
		/** @type {Array<{ src: string, alt?: string, title?: string }>} */
		images = [],
		class: className = ''
	} = $props();

	let trackEl = $state(null);
	let active = $state(0);

	const caption = $derived(images[active]?.title || images[active]?.alt || '');

	let scrollFrame = 0;

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
	}

	function onScroll() {
		if (scrollFrame) return;
		scrollFrame = requestAnimationFrame(() => {
			scrollFrame = 0;
			syncActive();
		});
	}

	function goTo(i) {
		const slide = trackEl?.children[i];
		if (!slide) return;
		const smooth =
			typeof window !== 'undefined' &&
			!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		trackEl.scrollTo({
			left: slide.offsetLeft - (trackEl.clientWidth - slide.offsetWidth) / 2,
			behavior: smooth ? 'smooth' : 'auto'
		});
	}

	$effect(() => () => cancelAnimationFrame(scrollFrame));
</script>

<figure class="gallery {className}">
	<!-- A scroll container is keyboard-operable, so it has to be reachable by tab
	     for the arrow keys to be able to reach it. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		class="gallery-track"
		bind:this={trackEl}
		onscroll={onScroll}
		data-lightbox-group
		tabindex="0"
		role="group"
		aria-label="Image gallery, {images.length} images"
	>
		{#each images as image, i (image.src + i)}
			<div class="gallery-slide">
				<img src={image.src} alt={image.alt ?? ''} loading="lazy" decoding="async" />
			</div>
		{/each}
	</div>

	{#if images.length > 1}
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

	<!-- Held open at one line so paging between a captioned and an uncaptioned
	     image doesn't shunt the rest of the article up and down. -->
	<figcaption class="gallery-caption" aria-live="polite">{caption}</figcaption>
</figure>

<style>
	.gallery {
		margin: 2rem 0;
	}

	.gallery-track {
		position: relative;
		display: flex;
		gap: 0.75rem;
		overflow-x: auto;
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
		height: clamp(220px, 52vw, 460px);
		scroll-snap-align: center;
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
	}

	.gallery-steps {
		display: flex;
		justify-content: center;
		margin-top: 0.75rem;
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

	.gallery-caption {
		min-height: 1.5em;
		margin-top: 0.5rem;
		text-align: center;
		font-size: 0.875rem;
		line-height: 1.5;
		color: rgb(115 115 115);
	}

	:global(.dark) .gallery-caption {
		color: rgb(163 163 163);
	}

	@media (prefers-reduced-motion: reduce) {
		.gallery-track {
			scroll-behavior: auto;
		}
	}
</style>
