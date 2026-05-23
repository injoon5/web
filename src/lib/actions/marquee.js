export function marqueePauseWhenOffscreen(node) {
	const io = new IntersectionObserver(
		([entry]) => {
			node.style.animationPlayState = entry.isIntersecting ? 'running' : 'paused';
		},
		{ threshold: 0 }
	);
	io.observe(node);
	return { destroy: () => io.disconnect() };
}

// Drives marquee duration by scroll-distance, not track count, so it always
// moves at ~40px/s regardless of how many items are loaded.
export function marqueeConstantSpeed(node) {
	const PX_PER_SECOND = 40;
	function tune() {
		// Track list is duplicated; we translate by -50%, so the distance
		// travelled equals half the full scrollWidth.
		const distance = node.scrollWidth / 2;
		if (distance <= 0) return;
		node.style.animationDuration = `${distance / PX_PER_SECOND}s`;
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
	return { destroy: () => ro.disconnect() };
}
