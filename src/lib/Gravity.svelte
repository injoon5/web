<script>
	import { onMount, onDestroy } from 'svelte';

	const TRIGGER_WORD = 'gravity';
	const GRAVITY = 1800;
	const BOUNCE_DAMPING = 0.3;
	const FRICTION = 0.95;
	const SETTLE_THRESHOLD = 0.5;

	let buffer = '';
	let active = false;
	let animFrameId = null;

	function handleKeydown(e) {
		if (active) return;
		if (e.key.length !== 1) return;
		buffer += e.key.toLowerCase();
		if (buffer.length > TRIGGER_WORD.length) {
			buffer = buffer.slice(-TRIGGER_WORD.length);
		}
		if (buffer === TRIGGER_WORD) {
			buffer = '';
			activate();
		}
	}

	function getElements() {
		const all = document.body.querySelectorAll(
			'nav, footer, div, p, a, h1, h2, h3, h4, h5, h6, span, img, button, li, ul, ol, section, article, header, pre, code, blockquote, table, form, input, textarea, label, svg'
		);
		const elements = [];
		for (const el of all) {
			// skip elements that contain other block-level children — we want leaf-ish nodes
			if (el.querySelector('div, p, h1, h2, h3, h4, h5, h6, section, article, header, ul, ol, li, nav, footer, pre, blockquote, table, form')) {
				continue;
			}
			const rect = el.getBoundingClientRect();
			if (rect.width === 0 || rect.height === 0) continue;
			if (rect.top > window.innerHeight + 200) continue;
			elements.push(el);
		}
		return elements;
	}

	function activate() {
		active = true;

		// Extend body so elements can fall far
		const fullHeight = document.documentElement.scrollHeight;
		const floorY = fullHeight;

		const elements = getElements();
		const bodies = [];

		for (const el of elements) {
			const rect = el.getBoundingClientRect();
			const scrollX = window.scrollX;
			const scrollY = window.scrollY;

			const x = rect.left + scrollX;
			const y = rect.top + scrollY;
			const w = rect.width;
			const h = rect.height;

			// Fix size before making absolute
			el.style.width = w + 'px';
			el.style.height = h + 'px';
			el.style.position = 'absolute';
			el.style.left = x + 'px';
			el.style.top = y + 'px';
			el.style.margin = '0';
			el.style.zIndex = '9999';
			el.style.transition = 'none';

			bodies.push({
				el,
				x,
				y,
				w,
				h,
				vy: 0,
				vx: (Math.random() - 0.5) * 100,
				settled: false
			});
		}

		let lastTime = performance.now();

		function step(now) {
			const dt = Math.min((now - lastTime) / 1000, 0.05);
			lastTime = now;

			let allSettled = true;

			for (const body of bodies) {
				if (body.settled) continue;

				body.vy += GRAVITY * dt;
				body.vx *= FRICTION;

				body.x += body.vx * dt;
				body.y += body.vy * dt;

				const bottom = body.y + body.h;

				// Floor collision
				if (bottom >= floorY) {
					body.y = floorY - body.h;
					body.vy = -body.vy * BOUNCE_DAMPING;

					if (Math.abs(body.vy) < SETTLE_THRESHOLD) {
						body.vy = 0;
						body.settled = true;
					}
				}

				// Wall collisions
				const maxX = window.innerWidth - body.w;
				if (body.x < 0) {
					body.x = 0;
					body.vx = -body.vx * BOUNCE_DAMPING;
				} else if (body.x > maxX) {
					body.x = maxX;
					body.vx = -body.vx * BOUNCE_DAMPING;
				}

				body.el.style.left = body.x + 'px';
				body.el.style.top = body.y + 'px';

				if (!body.settled) allSettled = false;
			}

			if (!allSettled) {
				animFrameId = requestAnimationFrame(step);
			}
		}

		animFrameId = requestAnimationFrame(step);
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeydown);
	});

	onDestroy(() => {
		window.removeEventListener('keydown', handleKeydown);
		if (animFrameId) cancelAnimationFrame(animFrameId);
	});
</script>
