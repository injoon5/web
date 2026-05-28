<script>
	import { lightboxStore, MAX_LIGHTBOX_HEIGHT } from './lightbox.js';
	import { onDestroy } from 'svelte';

	let visible = false;
	let src = '';
	let alt = '';
	let naturalWidth = 0;
	let naturalHeight = 0;
	let zoomed = false;
	let imgEl;
	let backdropEl;
	let closeBtn;
	let closing = false;
	let swipeDismissing = false;

	// Touch swipe-to-close (single finger)
	let touchStartY = 0;
	let dragY = 0;
	let dragging = false;

	// Pinch-zoom state
	let pinching = false;
	let pinchScale = 1; // scale during active pinch
	let committedScale = 1; // scale we keep after pinch ends
	let pinchStartDist = 0;
	let touchStartX = 0;
	let panX = 0;
	let panY = 0;
	let lastPanX = 0;
	let lastPanY = 0;

	function resetPan() {
		panX = panY = lastPanX = lastPanY = 0;
	}

	// Focus trap bookkeeping
	let previouslyFocused = null;

	// Viewport size — used to reserve the image box before the src loads,
	// which prevents a layout shift when the image arrives after the open.
	let winW = typeof window !== 'undefined' ? window.innerWidth : 0;
	let winH = typeof window !== 'undefined' ? window.innerHeight : 0;

	// Displayed size, computed the same way object-fit: contain would, but
	// from the known natural dimensions so the box has its final size up front.
	$: fit = (() => {
		if (!naturalWidth || !naturalHeight || !winW || !winH) return null;
		const availW = winW - 32; // 1rem padding each side
		const availH = Math.min(winH - 96, MAX_LIGHTBOX_HEIGHT); // viewport cap + max vertical size
		const scale = Math.min(availW / naturalWidth, availH / naturalHeight, 1);
		return { w: Math.round(naturalWidth * scale), h: Math.round(naturalHeight * scale) };
	})();

	$: {
		const val = $lightboxStore;
		if (val) {
			src = val.src;
			alt = val.alt;
			naturalWidth = val.naturalWidth || 0;
			naturalHeight = val.naturalHeight || 0;
			zoomed = false;
			dragY = 0;
			dragging = false;
			closing = false;
			swipeDismissing = false;
			pinching = false;
			pinchScale = 1;
			committedScale = 1;
			resetPan();
			visible = true;
		} else {
			visible = false;
			closing = false;
			swipeDismissing = false;
		}
	}

	// When the lightbox becomes visible, capture focus and move it inside.
	$: if (visible && typeof document !== 'undefined') {
		previouslyFocused = document.activeElement;
		queueMicrotask(() => closeBtn?.focus());
	} else if (!visible && previouslyFocused && typeof document !== 'undefined') {
		// Restore focus when closing
		try {
			previouslyFocused.focus();
		} catch {
			// Element may have been removed from the DOM.
		}
		previouslyFocused = null;
	}

	function close() {
		if (closing) return;
		closing = true;
		setTimeout(() => lightboxStore.set(null), 230);
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

	function handleKeydown(e) {
		if (!visible) return;
		if (e.key === 'Escape') {
			close();
			return;
		}
		if (e.key === 'Tab') {
			// Single focusable element → keep focus on it, regardless of direction.
			e.preventDefault();
			closeBtn?.focus();
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
			if (committedScale > 1) {
				// pan instead of swipe-dismiss
				dragging = true;
				touchStartX = e.touches[0].clientX;
				touchStartY = e.touches[0].clientY;
				lastPanX = panX;
				lastPanY = panY;
				return;
			}
			touchStartX = e.touches[0].clientX;
			touchStartY = e.touches[0].clientY;
			dragY = 0;
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
		// single-finger swipe-to-dismiss
		e.preventDefault();
		dragY = e.touches[0].clientY - touchStartY;
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
		if (Math.abs(dragY) > 80) {
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
		previouslyFocused = null;
	});

	$: liveScale = pinching ? pinchScale : committedScale;
</script>

<svelte:window on:keydown={handleKeydown} bind:innerWidth={winW} bind:innerHeight={winH} />

{#if visible}
	<div
		bind:this={backdropEl}
		class="lb-backdrop"
		class:closing
		class:swipe-dismissing={swipeDismissing}
		style="--lb-max-height: {MAX_LIGHTBOX_HEIGHT}px"
		role="dialog"
		aria-modal="true"
		aria-label={alt || 'Image preview'}
		tabindex="-1"
		on:click={handleBackdropClick}
		on:keydown={handleBackdropKeydown}
		on:touchstart={onTouchStart}
		on:touchmove={onTouchMove}
		on:touchend={onTouchEnd}
		on:touchcancel={onTouchCancel}
		on:wheel={onWheel}
	>
		<!-- Drag wrapper — owns translateY so it doesn't conflict with lb-img-wrap's CSS animation -->
		<div
			class="lb-drag-wrapper"
			style="transform: translate({panX}px, {dragY + panY}px); transition: {dragging || pinching
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
				on:click={toggleZoom}
				on:keydown={handleImageKeydown}
			>
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
				/>
				{#if alt}
					<p class="lb-caption">{alt}</p>
				{/if}
			</div>
		</div>

		<!-- Chrome layer — stays above transformed image content -->
		<div class="lb-chrome">
			<button bind:this={closeBtn} class="lb-close" on:click={close} aria-label="Close image">
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

	.lb-drag-wrapper {
		position: relative;
		z-index: 1;
		display: flex;
		max-width: 100%;
		max-height: 100%;
		will-change: transform;
	}

	.lb-chrome {
		position: fixed;
		inset: 0;
		z-index: 2;
		pointer-events: none;
	}

	.lb-close {
		position: fixed;
		top: 1rem;
		right: 1rem;
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
			transform 0.15s ease;
	}

	.lb-close:hover {
		background: rgba(0, 0, 0, 0.72);
		transform: scale(1.05);
	}

	.lb-close:focus-visible {
		outline: 2px solid rgba(255, 255, 255, 0.65);
		outline-offset: 2px;
	}

	.lb-close svg {
		width: 1.125rem;
		height: 1.125rem;
	}

	.lb-drag-wrapper {
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
		max-height: min(calc(100dvh - 6rem), var(--lb-max-height));
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
	}

	.lb-img.zoomed {
		max-width: none;
		max-height: none;
		width: 100%;
		cursor: zoom-out;
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
</style>
