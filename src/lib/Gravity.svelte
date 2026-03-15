<script>
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';

	const TARGET = 'gravity';
	let buffer = '';
	let active = false;
	let animFrame;
	let objects = [];
	let toastVisible = false;

	function onKeyDown(e) {
		if (active && e.key === 'Escape') {
			window.location.reload();
			return;
		}
		if (active) return;

		buffer = (buffer + e.key.toLowerCase()).slice(-TARGET.length);
		if (buffer === TARGET) activate();
	}

	function activate() {
		active = true;
		toastVisible = true;
		setTimeout(() => (toastVisible = false), 2500);

		const selectors = 'h1,h2,h3,h4,p,a,img,button,li';
		const els = [...document.querySelectorAll(selectors)].filter((el) => {
			const r = el.getBoundingClientRect();
			return r.width > 0 && r.height > 0;
		});

		objects = els.map((el) => {
			const r = el.getBoundingClientRect();
			el.style.position = 'fixed';
			el.style.left = r.left + 'px';
			el.style.top = r.top + 'px';
			el.style.width = r.width + 'px';
			el.style.height = r.height + 'px';
			el.style.margin = '0';
			el.style.zIndex = '9000';
			el.style.pointerEvents = 'none';
			el.style.boxSizing = 'border-box';
			return {
				el,
				x: 0,
				y: 0,
				vx: (Math.random() - 0.5) * 60,
				vy: Math.random() * -30,
				rot: 0,
				angVel: (Math.random() - 0.5) * 150
			};
		});

		let last = performance.now();

		function step(now) {
			const dt = Math.min((now - last) / 1000, 0.05);
			last = now;
			let alive = false;
			for (const o of objects) {
				if (!o.el) continue;
				o.vy += 980 * dt;
				o.x += o.vx * dt;
				o.y += o.vy * dt;
				o.rot += o.angVel * dt;
				o.el.style.transform = `translate(${o.x}px,${o.y}px) rotate(${o.rot}deg)`;
				const top = parseFloat(o.el.style.top);
				if (top + o.y < window.innerHeight + 200) alive = true;
			}
			if (alive) animFrame = requestAnimationFrame(step);
		}

		animFrame = requestAnimationFrame(step);
	}

	onMount(() => window.addEventListener('keydown', onKeyDown));
	onDestroy(() => {
		if (!browser) return;
		window.removeEventListener('keydown', onKeyDown);
		if (animFrame) cancelAnimationFrame(animFrame);
	});
</script>

{#if toastVisible}
	<div class="gravity-toast">🌍 Gravity mode — press ESC to escape</div>
{/if}

<style>
	.gravity-toast {
		position: fixed;
		bottom: 2rem;
		left: 50%;
		transform: translateX(-50%);
		background: #171717;
		color: #fafafa;
		padding: 0.5rem 1.25rem;
		font-size: 0.875rem;
		font-family: inherit;
		z-index: 99999;
		pointer-events: none;
		white-space: nowrap;
	}

	:global(.dark) .gravity-toast {
		background: #fafafa;
		color: #171717;
	}
</style>
