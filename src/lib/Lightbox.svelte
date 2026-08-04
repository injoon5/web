<script>
	import { lightboxStore, MAX_LIGHTBOX_HEIGHT, normalizeLightboxValue } from './lightbox.js';
	import Stepper from './pasito/Stepper.svelte';
	import { onDestroy } from 'svelte';

	let visible = $state(false);
	// The group the lightbox was opened on. A single image is a group of one, so
	// there is only one code path through sizing, swiping and dismissal.
	let items = $state([]);
	let index = $state(0);
	let zoomed = $state(false);
	let imgEl = $state(null);
	let backdropEl = $state(null);
	let closeBtn = $state(null);
	let closing = $state(false);
	let swipeDismissing = $state(false);

	const current = $derived(items[index] ?? null);
	const src = $derived(current?.src ?? '');
	const alt = $derived(current?.alt ?? '');
	const naturalWidth = $derived(current?.naturalWidth ?? 0);
	const naturalHeight = $derived(current?.naturalHeight ?? 0);
	const grouped = $derived(items.length > 1);

	// Touch drag (single finger). The axis is locked on the first few pixels of
	// movement: sideways pages through the group, downward dismisses. Deciding
	// per-move instead would let a diagonal flick do both.
	let touchStartY = 0;
	let dragY = $state(0);
	let dragX = $state(0);
	/** @type {null | 'x' | 'y'} */
	let axis = $state(null);
	let dragging = $state(false);

	const AXIS_LOCK = 8; // px of movement before the axis is committed
	const PAGE_THRESHOLD = 60; // px of sideways drag that pages to the next image
	const DISMISS_THRESHOLD = 80; // px of downward drag that dismisses

	// Pinch-zoom state
	let pinching = $state(false);
	let pinchScale = $state(1); // scale during active pinch
	let committedScale = $state(1); // scale we keep after pinch ends
	let pinchStartDist = 0;
	let touchStartX = 0;
	let panX = $state(0);
	let panY = $state(0);
	let lastPanX = 0;
	let lastPanY = 0;

	function resetPan() {
		panX = panY = lastPanX = lastPanY = 0;
	}

	function resetGesture() {
		zoomed = false;
		dragX = 0;
		dragY = 0;
		axis = null;
		dragging = false;
		pinching = false;
		pinchScale = 1;
		committedScale = 1;
		resetPan();
	}

	// Focus trap bookkeeping
	let previouslyFocused = null;
	let wasVisible = false;

	// While the lightbox is open, darken the browser chrome (mobile address bar)
	// to match the dark blurred backdrop instead of the page's light/dark theme.
	const LIGHTBOX_THEME_COLOR = '#0a0a0a';
	let savedThemeColor = null;

	function applyLightboxThemeColor() {
		if (typeof document === 'undefined' || savedThemeColor) return;
		const metas = Array.from(document.querySelectorAll('meta[name="theme-color"]'));
		if (metas.length === 0) {
			// Nothing to override — inject a temporary meta we remove on close.
			const el = document.createElement('meta');
			el.setAttribute('name', 'theme-color');
			el.setAttribute('content', LIGHTBOX_THEME_COLOR);
			document.head.appendChild(el);
			savedThemeColor = [{ el, content: null, media: null, injected: true }];
			return;
		}
		// Drop the media gate and force dark so the override wins in any scheme.
		savedThemeColor = metas.map((el) => ({
			el,
			content: el.getAttribute('content'),
			media: el.getAttribute('media')
		}));
		for (const { el } of savedThemeColor) {
			el.removeAttribute('media');
			el.setAttribute('content', LIGHTBOX_THEME_COLOR);
		}
	}

	function restoreThemeColor() {
		if (!savedThemeColor) return;
		for (const entry of savedThemeColor) {
			if (entry.injected) {
				entry.el.remove();
				continue;
			}
			if (entry.content === null) entry.el.removeAttribute('content');
			else entry.el.setAttribute('content', entry.content);
			if (entry.media === null) entry.el.removeAttribute('media');
			else entry.el.setAttribute('media', entry.media);
		}
		savedThemeColor = null;
	}

	// Viewport size — used to reserve the image box before the src loads,
	// which prevents a layout shift when the image arrives after the open.
	let winW = $state(typeof window !== 'undefined' ? window.innerWidth : 0);
	let winH = $state(typeof window !== 'undefined' ? window.innerHeight : 0);

	// Vertical room the chrome needs: the close button's row, plus the stepper's
	// row when there is a group to step through.
	const verticalReserve = $derived(grouped ? 140 : 96);

	// Displayed size, computed the same way object-fit: contain would, but
	// from the known natural dimensions so the box has its final size up front.
	const fit = $derived.by(() => {
		if (!naturalWidth || !naturalHeight || !winW || !winH) return null;
		const availW = winW - 32; // 1rem padding each side
		const availH = Math.min(winH - verticalReserve, MAX_LIGHTBOX_HEIGHT);
		const scale = Math.min(availW / naturalWidth, availH / naturalHeight, 1);
		return { w: Math.round(naturalWidth * scale), h: Math.round(naturalHeight * scale) };
	});

	$effect(() => {
		const val = normalizeLightboxValue($lightboxStore);
		if (val) {
			items = val.items;
			index = val.index;
			resetGesture();
			closing = false;
			swipeDismissing = false;
			visible = true;
		} else {
			visible = false;
			closing = false;
			swipeDismissing = false;
		}
	});

	// Warm the neighbours so paging through a group doesn't flash an empty box.
	$effect(() => {
		if (!visible || !grouped || typeof Image === 'undefined') return;
		for (const neighbour of [items[index + 1], items[index - 1]]) {
			if (!neighbour?.src) continue;
			const preload = new Image();
			preload.src = neighbour.src;
		}
	});

	// Capture/restore focus only on the actual open<->close transition. Gating on
	// `wasVisible` stops a re-run (e.g. when `closeBtn` binds) from re-capturing
	// `previouslyFocused` as the close button itself, which would otherwise break
	// focus restoration to the element that opened the lightbox.
	$effect(() => {
		if (visible && !wasVisible) {
			previouslyFocused = document.activeElement;
			applyLightboxThemeColor();
			queueMicrotask(() => closeBtn?.focus());
			wasVisible = true;
		} else if (!visible && wasVisible) {
			restoreThemeColor();
			if (previouslyFocused) {
				try {
					previouslyFocused.focus();
				} catch {
					// Element may have been removed from the DOM.
				}
				previouslyFocused = null;
			}
			wasVisible = false;
		}
	});

	function close() {
		if (closing) return;
		closing = true;
		setTimeout(() => lightboxStore.set(null), 230);
	}

	/** Page to another image in the group. Clamped, so the ends are ends. */
	function goTo(next) {
		if (!items.length) return;
		const clamped = Math.max(0, Math.min(next, items.length - 1));
		if (clamped === index) {
			dragX = 0;
			return;
		}
		index = clamped;
		resetGesture();
	}

	/**
	 * An image collected from the page before it had loaded carries no natural
	 * size, and `fit` needs one to reserve the box. Fill it in once from the
	 * element the lightbox itself just loaded.
	 */
	function onImageLoad(e) {
		const el = e.currentTarget;
		const item = items[index];
		if (!item || item.naturalWidth) return;
		item.naturalWidth = el.naturalWidth;
		item.naturalHeight = el.naturalHeight;
	}

	function isBackdropTarget(target) {
		return target === backdropEl || target?.classList?.contains('lb-backdrop');
	}

	function handleBackdropClick(e) {
		if (isBackdropTarget(e.target)) {
			close();
		}
	}

	function handleBackdropKeydown(e) {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		if (isBackdropTarget(e.target)) {
			e.preventDefault();
			close();
		}
	}

	/** Everything inside the dialog a Tab can legitimately land on. */
	function focusables() {
		if (!backdropEl) return [];
		return Array.from(
			backdropEl.querySelectorAll('button:not([disabled]):not([tabindex="-1"]), [tabindex="0"]')
		);
	}

	function handleKeydown(e) {
		if (!visible) return;
		if (e.key === 'Escape') {
			close();
			return;
		}
		if (grouped && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
			e.preventDefault();
			goTo(index + (e.key === 'ArrowRight' ? 1 : -1));
			return;
		}
		if (e.key === 'Tab') {
			// Keep focus in the dialog. With one focusable it parks there, which is
			// what this did before the group chrome added any others.
			const list = focusables();
			if (list.length === 0) return;
			e.preventDefault();
			const at = list.indexOf(document.activeElement);
			const next = e.shiftKey
				? at <= 0
					? list.length - 1
					: at - 1
				: at === -1 || at === list.length - 1
					? 0
					: at + 1;
			list[next]?.focus();
		}
	}

	function handleImageKeydown(e) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			toggleZoom();
		}
	}

	function toggleZoom() {
		if (pinching) return;
		if (committedScale > 1) {
			// pinch-zoom in effect → reset on tap
			committedScale = 1;
			resetPan();
			zoomed = false;
			return;
		}
		zoomed = !zoomed;
	}

	// --- Touch handlers (single finger = swipe, two fingers = pinch) ---
	function onTouchStart(e) {
		if (closing || swipeDismissing) return;
		if (e.touches.length === 2) {
			// begin pinch
			pinching = true;
			dragging = false;
			const [a, b] = e.touches;
			pinchStartDist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
			pinchScale = committedScale;
			return;
		}
		if (e.touches.length === 1 && !pinching) {
			touchStartX = e.touches[0].clientX;
			touchStartY = e.touches[0].clientY;
			if (committedScale > 1) {
				// pan instead of swipe/dismiss
				dragging = true;
				lastPanX = panX;
				lastPanY = panY;
				return;
			}
			dragX = 0;
			dragY = 0;
			axis = null;
			dragging = true;
		}
	}

	function onTouchMove(e) {
		if (pinching && e.touches.length === 2) {
			e.preventDefault();
			const [a, b] = e.touches;
			const dist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
			const ratio = dist / (pinchStartDist || 1);
			pinchScale = Math.max(1, Math.min(4, committedScale * ratio));
			return;
		}
		if (!dragging) return;
		if (committedScale > 1 && e.touches.length === 1) {
			// pan
			e.preventDefault();
			const t = e.touches[0];
			panX = lastPanX + (t.clientX - touchStartX);
			panY = lastPanY + (t.clientY - touchStartY);
			return;
		}

		const t = e.touches[0];
		const dx = t.clientX - touchStartX;
		const dy = t.clientY - touchStartY;

		if (!axis) {
			if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return;
			// Sideways only means something when there is somewhere to go.
			axis = grouped && Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
		}

		e.preventDefault();
		if (axis === 'x') {
			// Rubber-band at the ends so the group's edges are felt, not hit.
			const atEnd = (dx > 0 && index === 0) || (dx < 0 && index === items.length - 1);
			dragX = atEnd ? dx * 0.35 : dx;
		} else {
			dragY = dy;
		}
	}

	function onTouchEnd() {
		if (pinching) {
			// Pinch finished — commit scale, keep pan offsets.
			committedScale = pinchScale;
			if (committedScale <= 1.02) {
				committedScale = 1;
				resetPan();
			}
			pinching = false;
			pinchStartDist = 0;
			return;
		}
		dragging = false;
		if (committedScale > 1) return; // we were panning, not dismissing

		if (axis === 'x') {
			if (dragX <= -PAGE_THRESHOLD) goTo(index + 1);
			else if (dragX >= PAGE_THRESHOLD) goTo(index - 1);
			dragX = 0;
			axis = null;
			return;
		}

		axis = null;
		if (Math.abs(dragY) > DISMISS_THRESHOLD) {
			swipeDismissing = true;
			dragY = dragY > 0 ? window.innerHeight : -window.innerHeight;
			setTimeout(() => lightboxStore.set(null), 320);
		} else {
			dragY = 0;
		}
	}

	function onTouchCancel() {
		dragging = false;
		pinching = false;
		axis = null;
		dragX = 0;
		dragY = 0;
	}

	// Wheel-zoom on desktop while holding ctrl/cmd or just scrolling on the image.
	function onWheel(e) {
		if (!visible) return;
		if (!e.ctrlKey && !e.metaKey) return;
		e.preventDefault();
		const next = Math.max(1, Math.min(4, committedScale - e.deltaY * 0.0025));
		committedScale = next;
		if (committedScale === 1) {
			resetPan();
		}
	}

	onDestroy(() => {
		restoreThemeColor();
		previouslyFocused = null;
	});

	const liveScale = $derived(pinching ? pinchScale : committedScale);
	const dialogLabel = $derived(
		grouped ? `${alt || 'Image preview'} — ${index + 1} of ${items.length}` : alt || 'Image preview'
	);
</script>

<svelte:window onkeydown={handleKeydown} bind:innerWidth={winW} bind:innerHeight={winH} />

{#if visible}
	<div
		bind:this={backdropEl}
		class="lb-backdrop"
		class:closing
		class:swipe-dismissing={swipeDismissing}
		style="--lb-max-height: {MAX_LIGHTBOX_HEIGHT}px; --lb-vertical-reserve: {verticalReserve}px"
		role="dialog"
		aria-modal="true"
		aria-label={dialogLabel}
		tabindex="-1"
		onclick={handleBackdropClick}
		onkeydown={handleBackdropKeydown}
		ontouchstart={onTouchStart}
		ontouchmove={onTouchMove}
		ontouchend={onTouchEnd}
		ontouchcancel={onTouchCancel}
		onwheel={onWheel}
	>
		<!-- Drag wrapper — owns the translate so it doesn't conflict with lb-img-wrap's CSS animation -->
		<div
			class="lb-drag-wrapper"
			style="transform: translate({panX + dragX}px, {dragY + panY}px); transition: {dragging ||
			pinching
				? 'none'
				: 'transform 0.32s cubic-bezier(0.16,1,0.3,1)'};"
		>
			<!-- Image wrapper -->
			<div
				class="lb-img-wrap"
				class:zoomed
				class:closing
				role="button"
				tabindex="0"
				aria-label={zoomed ? 'Zoom out image' : 'Zoom in image'}
				onclick={toggleZoom}
				onkeydown={handleImageKeydown}
			>
				{#key index}
					<img
						bind:this={imgEl}
						{src}
						{alt}
						class="lb-img"
						class:zoomed
						style="{!zoomed && fit
							? `width: ${fit.w}px; height: ${fit.h}px;`
							: ''} transform: scale({liveScale}); transition: {pinching ? 'none' : ''};"
						draggable="false"
						onload={onImageLoad}
					/>
				{/key}
				{#if alt}
					<p class="lb-caption">{alt}</p>
				{/if}
			</div>
		</div>

		<!-- Chrome layer — stays above transformed image content -->
		<div class="lb-chrome">
			<button bind:this={closeBtn} class="lb-btn lb-close" onclick={close} aria-label="Close image">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</button>

			{#if grouped}
				<button
					class="lb-btn lb-prev"
					onclick={() => goTo(index - 1)}
					disabled={index === 0}
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
					class="lb-btn lb-next"
					onclick={() => goTo(index + 1)}
					disabled={index === items.length - 1}
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

				<div class="lb-steps">
					<Stepper
						count={items.length}
						active={index}
						onStepClick={goTo}
						maxVisible={9}
						class="lb-stepper"
						label="Images in this group"
						containerRole="group"
						stepRole="button"
						stepLabel={(i, total) => `Go to image ${i + 1} of ${total}`}
					/>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.lb-backdrop {
		position: fixed;
		inset: 0;
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.85);
		backdrop-filter: blur(6px);
		-webkit-backdrop-filter: blur(6px);
		padding: 1rem;
		animation: lb-fade-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
		will-change: opacity;
		cursor: zoom-out;
		touch-action: none;
	}

	.lb-backdrop.closing {
		animation: lb-fade-out 0.22s cubic-bezier(0.4, 0, 1, 1) forwards;
	}

	.lb-backdrop.swipe-dismissing {
		animation: lb-fade-out 0.32s ease forwards;
	}

	@keyframes lb-fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes lb-fade-out {
		from {
			opacity: 1;
		}
		to {
			opacity: 0;
		}
	}

	.lb-chrome {
		position: fixed;
		inset: 0;
		z-index: 2;
		pointer-events: none;
	}

	.lb-btn {
		position: fixed;
		width: 2.5rem;
		height: 2.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 9999px;
		background: rgba(0, 0, 0, 0.55);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		color: white;
		border: none;
		cursor: pointer;
		pointer-events: auto;
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
		transition:
			background-color 0.15s ease,
			opacity 0.15s ease,
			transform 0.15s ease;
	}

	.lb-btn:hover:not(:disabled) {
		background: rgba(0, 0, 0, 0.72);
		transform: scale(1.05);
	}

	.lb-btn:disabled {
		opacity: 0.3;
		cursor: default;
	}

	.lb-btn:focus-visible {
		outline: 2px solid rgba(255, 255, 255, 0.65);
		outline-offset: 2px;
	}

	.lb-btn svg {
		width: 1.125rem;
		height: 1.125rem;
	}

	.lb-close {
		top: 1rem;
		right: 1rem;
	}

	.lb-prev,
	.lb-next {
		top: 50%;
		margin-top: -1.25rem;
	}

	.lb-prev {
		left: 1rem;
	}

	.lb-next {
		right: 1rem;
	}

	/* On a phone the arrows would sit on top of the image and duplicate what the
	   swipe already does — the stepper is the control that stays. */
	@media (max-width: 640px), (pointer: coarse) {
		.lb-prev,
		.lb-next {
			display: none;
		}
	}

	.lb-steps {
		position: fixed;
		left: 50%;
		bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
		transform: translateX(-50%);
		pointer-events: auto;
	}

	.lb-steps :global(.lb-stepper) {
		--pill-bg: rgba(255, 255, 255, 0.28);
		--pill-active-bg: rgba(255, 255, 255, 0.95);
		--pill-fill-bg: rgba(255, 255, 255, 0.35);
		--pill-container-bg: rgba(0, 0, 0, 0.55);
		--pill-container-border: rgba(255, 255, 255, 0.12);
		--pill-focus-ring: rgba(255, 255, 255, 0.65);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
	}

	.lb-drag-wrapper {
		position: relative;
		z-index: 1;
		display: flex;
		max-width: 100%;
		max-height: 100%;
		will-change: transform;
	}

	.lb-img-wrap {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		max-width: 100%;
		max-height: 100%;
		animation: lb-img-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
		will-change: transform, opacity;
		cursor: zoom-in;
	}

	.lb-img-wrap.closing {
		animation: lb-img-out 0.22s cubic-bezier(0.4, 0, 1, 1) forwards;
	}

	.lb-img-wrap.zoomed {
		cursor: zoom-out;
		overflow: auto;
	}

	@keyframes lb-img-in {
		from {
			opacity: 0;
			transform: scale(0.88);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	@keyframes lb-img-out {
		from {
			opacity: 1;
			transform: scale(1);
		}
		to {
			opacity: 0;
			transform: scale(0.88);
		}
	}

	.lb-img {
		max-width: 100%;
		max-height: min(calc(100dvh - var(--lb-vertical-reserve)), var(--lb-max-height));
		width: auto;
		height: auto;
		object-fit: contain;
		will-change: transform;
		border-radius: 0.375rem;
		box-shadow:
			0 25px 60px rgba(0, 0, 0, 0.5),
			0 0 0 1px rgba(255, 255, 255, 0.06);
		transition:
			transform 0.35s cubic-bezier(0.16, 1, 0.3, 1),
			width 0.35s cubic-bezier(0.16, 1, 0.3, 1),
			height 0.35s cubic-bezier(0.16, 1, 0.3, 1),
			max-width 0.35s cubic-bezier(0.16, 1, 0.3, 1),
			max-height 0.35s cubic-bezier(0.16, 1, 0.3, 1);
		user-select: none;
		cursor: zoom-in;
		transform-origin: center center;
		/* Paging swaps the element via {#key}; fade it in so the change reads as a
		   change and not as a flicker. Neighbours are preloaded, so it is quick. */
		animation: lb-swap-in 0.18s ease both;
	}

	.lb-img.zoomed {
		max-width: none;
		max-height: none;
		width: 100%;
		cursor: zoom-out;
	}

	@keyframes lb-swap-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.lb-caption {
		color: rgba(255, 255, 255, 0.7);
		font-size: 0.875rem;
		text-align: center;
		max-width: 60ch;
		line-height: 1.5;
		margin: 0;
		pointer-events: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.lb-backdrop,
		.lb-img-wrap,
		.lb-img {
			animation-duration: 0.01ms !important;
		}
	}
</style>
