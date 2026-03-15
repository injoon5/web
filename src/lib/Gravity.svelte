<script>
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';

	const TARGET = 'gravity';
	let buffer = '';
	let active = false;
	let animFrame;

	function onKeyDown(e) {
		if (active) return;
		buffer = (buffer + e.key.toLowerCase()).slice(-TARGET.length);
		if (buffer === TARGET) activate();
	}

	function activate() {
		active = true;

		const COLS = 60;
		const colW = window.innerWidth / COLS;
		const floorY = new Array(COLS).fill(window.innerHeight);

		function getFloor(left, right) {
			const c1 = Math.max(0, Math.floor(left / colW));
			const c2 = Math.min(COLS - 1, Math.floor(right / colW));
			let floor = window.innerHeight;
			for (let c = c1; c <= c2; c++) floor = Math.min(floor, floorY[c]);
			return floor;
		}

		function markFloor(left, right, top) {
			const c1 = Math.max(0, Math.floor(left / colW));
			const c2 = Math.min(COLS - 1, Math.floor(right / colW));
			for (let c = c1; c <= c2; c++) floorY[c] = Math.min(floorY[c], top);
		}

		const nav = document.querySelector('nav');
		const selectors = 'h1,h2,h3,h4,p,a,img,button,li';

		const objects = [...document.querySelectorAll(selectors)]
			.filter((el) => {
				if (nav && nav.contains(el)) return false;
				const r = el.getBoundingClientRect();
				return r.width > 0 && r.height > 0;
			})
			.map((el) => {
				const r = el.getBoundingClientRect();
				el.style.cssText +=
					';position:fixed!important;left:' +
					r.left +
					'px;top:' +
					r.top +
					'px;width:' +
					r.width +
					'px;height:' +
					r.height +
					'px;margin:0;z-index:9000;pointer-events:none;box-sizing:border-box;';
				return {
					el,
					x: 0,
					y: 0,
					vx: (Math.random() - 0.5) * 60,
					vy: 0,
					rot: 0,
					angVel: (Math.random() - 0.5) * 150,
					done: false,
					top: r.top,
					left: r.left,
					w: r.width,
					h: r.height
				};
			});

		let last = performance.now();

		function step(now) {
			const dt = Math.min((now - last) / 1000, 0.05);
			last = now;
			let anyMoving = false;

			for (const o of objects) {
				if (o.done) continue;

				o.vy += 980 * dt;
				o.x += o.vx * dt;
				o.y += o.vy * dt;
				o.rot += o.angVel * dt;

				const sLeft = o.left + o.x;
				const sRight = sLeft + o.w;
				const sBottom = o.top + o.y + o.h;
				const floor = getFloor(sLeft, sRight);

				if (sBottom >= floor) {
					o.y = floor - o.h - o.top;
					o.vy = 0;
					o.vx = 0;
					o.angVel = 0;
					o.done = true;
					markFloor(o.left + o.x, o.left + o.x + o.w, floor - o.h);
					o.el.style.transform = `translate(${o.x}px,${o.y}px) rotate(${o.rot}deg)`;
				} else {
					o.el.style.transform = `translate(${o.x}px,${o.y}px) rotate(${o.rot}deg)`;
					anyMoving = true;
				}
			}

			if (anyMoving) animFrame = requestAnimationFrame(step);
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
