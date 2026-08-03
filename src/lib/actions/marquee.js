export function marqueePauseWhenOffscreen(node) {
	let intersecting = true;
	let hovered = false;

	function sync() {
		node.style.animationPlayState = intersecting && !hovered ? 'running' : 'paused';
	}

	const io = new IntersectionObserver(
		([entry]) => {
			intersecting = entry.isIntersecting;
			sync();
		},
		{ threshold: 0 }
	);
	io.observe(node);

	function onEnter() {
		hovered = true;
		sync();
	}
	function onLeave() {
		hovered = false;
		sync();
	}
	node.addEventListener('mouseenter', onEnter);
	node.addEventListener('mouseleave', onLeave);

	return {
		destroy() {
			io.disconnect();
			node.removeEventListener('mouseenter', onEnter);
			node.removeEventListener('mouseleave', onLeave);
		}
	};
}

// Drives marquee duration by scroll-distance, not track count, so it always
// moves at ~40px/s regardless of how many items are loaded.
export function marqueeConstantSpeed(node) {
	const PX_PER_SECOND = 40;

	// Read rather than hard-coded, so the tuning panel can move it by setting
	// `--marquee-speed` on the track. Unset — every production build — this is
	// the same 40 it always was.
	function speed() {
		const declared = Number(getComputedStyle(node).getPropertyValue('--marquee-speed'));
		return Number.isFinite(declared) && declared > 0 ? declared : PX_PER_SECOND;
	}

	function tune() {
		// Track list is duplicated; we translate by -50%, so the distance
		// travelled equals half the full scrollWidth.
		const distance = node.scrollWidth / 2;
		if (distance <= 0) return;
		node.style.animationDuration = `${distance / speed()}s`;
	}
	// Wait for images to settle so scrollWidth is final.
	const imgs = node.querySelectorAll('img');
	let pending = imgs.length;
	const done = () => {
		pending--;
		if (pending <= 0) tune();
	};
	imgs.forEach((img) => {
		if (img.complete) done();
		else {
			img.addEventListener('load', done, { once: true });
			img.addEventListener('error', done, { once: true });
		}
	});
	tune();
	const ro = new ResizeObserver(tune);
	ro.observe(node);

	// A speed change moves no boxes, so the observer above never hears about it.
	// The tuning panel says so directly instead; nothing in production ever
	// fires this.
	document.addEventListener('marquee:retune', tune);

	return {
		destroy: () => {
			ro.disconnect();
			document.removeEventListener('marquee:retune', tune);
		}
	};
}
