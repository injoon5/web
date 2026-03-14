<script>
	import { lightboxStore } from './lightbox.js';
	import { onMount } from 'svelte';

	let visible = false;
	let src = '';
	let alt = '';
	let zoomed = false;
	let imgEl;
	let backdropEl;
	// For touch swipe-to-close
	let touchStartY = 0;
	let dragY = 0;
	let dragging = false;

	lightboxStore.subscribe((val) => {
		if (val) {
			src = val.src;
			alt = val.alt;
			zoomed = false;
			dragY = 0;
			dragging = false;
			visible = true;
		} else {
			visible = false;
		}
	});

	function close() {
		lightboxStore.set(null);
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
		zoomed = !zoomed;
	}

	// Touch drag-to-dismiss
	function onTouchStart(e) {
		touchStartY = e.touches[0].clientY;
		dragging = true;
	}

	function onTouchMove(e) {
		if (!dragging) return;
		dragY = e.touches[0].clientY - touchStartY;
	}

	function onTouchEnd() {
		dragging = false;
		if (Math.abs(dragY) > 80) {
			close();
		} else {
			dragY = 0;
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if visible}
	<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
	<div
		bind:this={backdropEl}
		class="lb-backdrop"
		on:click={handleBackdropClick}
	>
		<!-- Close button -->
		<button class="lb-close" on:click={close} aria-label="Close image">
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<line x1="18" y1="6" x2="6" y2="18"/>
				<line x1="6" y1="6" x2="18" y2="18"/>
			</svg>
		</button>

		<!-- Image wrapper -->
		<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
		<div
			class="lb-img-wrap"
			class:zoomed
			style="transform: translateY({dragging ? dragY : 0}px); transition: {dragging ? 'none' : 'transform 0.35s cubic-bezier(0.16,1,0.3,1)'};"
			on:touchstart={onTouchStart}
			on:touchmove|passive={onTouchMove}
			on:touchend={onTouchEnd}
		>
			<img
				bind:this={imgEl}
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

	@keyframes lb-fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
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
		animation: lb-img-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
		cursor: zoom-in;
	}

	.lb-img-wrap.zoomed {
		cursor: zoom-out;
		overflow: auto;
		/* allow scrolling when zoomed */
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
