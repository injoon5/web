<script>
	import { tick } from 'svelte';
	import { lightboxStore } from './lightbox.js';

	let visible = false;
	let src = '';
	let alt = '';
	let zoomed = false;
	let imgWrapEl;
	let backdropEl;
	let closing = false;
	let swipeDismissing = false;
	let sourceRect = null;
	let hasSourceRect = false;
	let animating = false;

	// JS-driven transform state (replaces CSS keyframe animations when sourceRect present)
	let wrapTransform = '';
	let wrapTransition = '';

	// Touch/swipe state
	let touchStartY = 0;
	let dragY = 0;
	let dragging = false;
	let velocityY = 0;
	let lastTouchY = 0;
	let lastTouchTime = 0;

	$: wrapStyle = [
		wrapTransform ? `transform: ${wrapTransform}` : '',
		wrapTransition ? `transition: ${wrapTransition}` : ''
	].filter(Boolean).join('; ');

	lightboxStore.subscribe(async (val) => {
		if (val) {
			src = val.src;
			alt = val.alt;
			sourceRect = val.sourceRect || null;
			hasSourceRect = !!sourceRect;
			zoomed = false;
			dragY = 0;
			dragging = false;
			closing = false;
			swipeDismissing = false;
			animating = false;
			wrapTransform = '';
			wrapTransition = '';
			visible = true;

			if (sourceRect) {
				await tick();
				playOpenAnimation();
			}
		} else {
			visible = false;
			closing = false;
			swipeDismissing = false;
			animating = false;
			wrapTransform = '';
			wrapTransition = '';
		}
	});

	function playOpenAnimation() {
		if (!imgWrapEl || !sourceRect) return;

		const rect = imgWrapEl.getBoundingClientRect();
		if (!rect.width || !rect.height) return;

		const dx = (sourceRect.left + sourceRect.width / 2) - (rect.left + rect.width / 2);
		const dy = (sourceRect.top + sourceRect.height / 2) - (rect.top + rect.height / 2);
		const sx = sourceRect.width / rect.width;
		const sy = sourceRect.height / rect.height;

		animating = true;
		// Snap to thumbnail position instantly (no transition)
		wrapTransition = '';
		wrapTransform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;

		// Force reflow so the browser applies the initial transform before animating
		imgWrapEl.getBoundingClientRect();

		// Spring to natural center position
		wrapTransition = 'transform 0.42s cubic-bezier(0.16, 1, 0.3, 1)';
		wrapTransform = '';

		setTimeout(() => {
			if (!closing) {
				wrapTransition = '';
				animating = false;
			}
		}, 440);
	}

	function computeToSourceTransform() {
		if (!imgWrapEl || !sourceRect) return null;
		const rect = imgWrapEl.getBoundingClientRect();
		if (!rect.width || !rect.height) return null;

		const dx = (sourceRect.left + sourceRect.width / 2) - (rect.left + rect.width / 2);
		const dy = (sourceRect.top + sourceRect.height / 2) - (rect.top + rect.height / 2);
		const sx = sourceRect.width / rect.width;
		const sy = sourceRect.height / rect.height;

		return `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
	}

	function close(duration = 280) {
		if (closing) return;
		closing = true;

		if (sourceRect && imgWrapEl) {
			const t = computeToSourceTransform();
			if (t) {
				wrapTransition = `transform ${duration}ms cubic-bezier(0.4, 0, 0.6, 1)`;
				wrapTransform = t;
				setTimeout(() => lightboxStore.set(null), duration);
				return;
			}
		}
		// CSS fallback — lb-img-out and lb-fade-out handle it via class:closing
	}

	function onBackdropAnimationEnd(e) {
		// Only fire for the CSS-fallback close path (no sourceRect)
		if (closing && !hasSourceRect && e.animationName === 'lb-fade-out') {
			lightboxStore.set(null);
		}
	}

	function handleBackdropClick(e) {
		if (e.target === backdropEl || e.target.classList.contains('lb-backdrop')) {
			close();
		}
	}

	function handleKeydown(e) {
		if (!visible) return;
		if (e.key === 'Escape') close();
	}

	function toggleZoom() {
		if (!closing && !animating) zoomed = !zoomed;
	}

	// Touch drag-to-dismiss with velocity tracking
	function onTouchStart(e) {
		if (closing || zoomed) return;
		touchStartY = e.touches[0].clientY;
		lastTouchY = touchStartY;
		lastTouchTime = Date.now();
		dragY = 0;
		velocityY = 0;
		dragging = true;
		// Cancel any ongoing open animation so drag takes over immediately
		if (animating) {
			animating = false;
			wrapTransform = '';
		}
		wrapTransition = 'none';
	}

	function onTouchMove(e) {
		if (!dragging) return;
		e.preventDefault();

		const now = Date.now();
		const newY = e.touches[0].clientY;
		const dt = Math.max(now - lastTouchTime, 1);
		const iv = (newY - lastTouchY) / dt; // px/ms
		velocityY = velocityY * 0.7 + iv * 0.3; // exponential moving average

		lastTouchY = newY;
		lastTouchTime = now;
		dragY = newY - touchStartY;

		wrapTransition = 'none';
		wrapTransform = `translateY(${dragY}px)`;
	}

	function onTouchEnd() {
		if (!dragging) return;
		dragging = false;

		const speed = Math.abs(velocityY); // px/ms
		const dist = Math.abs(dragY);
		const shouldDismiss = dist > 80 || speed > 0.5;

		if (shouldDismiss) {
			// Faster gesture → shorter animation (inertia feel)
			const dur = Math.round(Math.max(180, Math.min(340, 300 - speed * 120)));
			closing = true;
			swipeDismissing = true;

			if (sourceRect && imgWrapEl) {
				// Shrink back to the thumbnail — same as intentional close
				const t = computeToSourceTransform();
				if (t) {
					wrapTransition = `transform ${dur}ms cubic-bezier(0.4, 0, 0.6, 1)`;
					wrapTransform = t;
					setTimeout(() => lightboxStore.set(null), dur);
					return;
				}
			}
			// Fallback: fly off screen in drag direction
			const flyDir = (dragY >= 0 ? 1 : -1) * window.innerHeight;
			wrapTransition = `transform ${dur}ms cubic-bezier(0.4, 0, 0.6, 1)`;
			wrapTransform = `translateY(${flyDir}px)`;
			setTimeout(() => lightboxStore.set(null), dur);
		} else {
			// Spring snap-back — higher release velocity → slightly bouncier spring
			const snapDur = Math.round(Math.min(620, Math.max(380, 400 + speed * 180)));
			wrapTransition = `transform ${snapDur}ms cubic-bezier(0.16, 1, 0.3, 1)`;
			wrapTransform = '';
			dragY = 0;
		}
	}

	function onTouchCancel() {
		dragging = false;
		dragY = 0;
		velocityY = 0;
		wrapTransition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
		wrapTransform = '';
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if visible}
	<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
	<div
		bind:this={backdropEl}
		class="lb-backdrop"
		class:closing
		class:swipe-dismissing={swipeDismissing}
		on:click={handleBackdropClick}
		on:animationend={onBackdropAnimationEnd}
		on:touchstart={onTouchStart}
		on:touchmove={onTouchMove}
		on:touchend={onTouchEnd}
		on:touchcancel={onTouchCancel}
	>
		<!-- Close button -->
		<button class="lb-close" on:click={close} aria-label="Close image">
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<line x1="18" y1="6" x2="6" y2="18"/>
				<line x1="6" y1="6" x2="18" y2="18"/>
			</svg>
		</button>

		<!-- Image wrapper — owns both the FLIP origin transform and swipe drag offset -->
		<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
		<div
			bind:this={imgWrapEl}
			class="lb-img-wrap"
			class:zoomed
			class:closing={closing && !hasSourceRect}
			class:js-origin={hasSourceRect}
			style={wrapStyle}
		>
			<img
				{src}
				{alt}
				class="lb-img"
				class:zoomed
				on:click={toggleZoom}
				draggable="false"
			/>
			{#if alt}
				<p class="lb-caption">{alt}</p>
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
		cursor: zoom-out;
	}

	.lb-backdrop.closing {
		animation: lb-fade-out 0.28s cubic-bezier(0.4, 0, 1, 1) forwards;
	}

	.lb-backdrop.swipe-dismissing {
		animation: lb-fade-out 0.35s ease forwards;
	}

	@keyframes lb-fade-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes lb-fade-out {
		from { opacity: 1; }
		to { opacity: 0; }
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
		background: rgba(255, 255, 255, 0.12);
		color: white;
		border: none;
		cursor: pointer;
		transition:
			background 0.15s ease,
			transform 0.15s ease;
		z-index: 10000;
	}

	.lb-close:hover {
		background: rgba(255, 255, 255, 0.22);
		transform: scale(1.1);
	}

	.lb-close svg {
		width: 1.125rem;
		height: 1.125rem;
	}

	.lb-img-wrap {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		max-width: 100%;
		max-height: 100%;
		/* CSS fallback animation — suppressed when JS handles it via .js-origin */
		animation: lb-img-in 0.32s cubic-bezier(0.16, 1, 0.3, 1) both;
		cursor: zoom-in;
		will-change: transform;
	}

	/* Suppress CSS keyframe when JS FLIP animation is active */
	.lb-img-wrap.js-origin {
		animation: none;
	}

	.lb-img-wrap.closing {
		animation: lb-img-out 0.28s cubic-bezier(0.4, 0, 1, 1) forwards;
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
		max-height: calc(100dvh - 6rem);
		width: auto;
		height: auto;
		object-fit: contain;
		border-radius: 0.375rem;
		box-shadow:
			0 25px 60px rgba(0, 0, 0, 0.5),
			0 0 0 1px rgba(255, 255, 255, 0.06);
		transition:
			transform 0.35s cubic-bezier(0.16, 1, 0.3, 1),
			max-width 0.35s cubic-bezier(0.16, 1, 0.3, 1),
			max-height 0.35s cubic-bezier(0.16, 1, 0.3, 1);
		user-select: none;
		cursor: zoom-in;
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
