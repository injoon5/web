/** Sets `data-in-view="true"` once the node enters the viewport (respects reduced motion). */
export function inViewOnce(node, { rootMargin = '-8% 0px', threshold = 0.12 } = {}) {
	const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	if (reduceMotion) {
		node.dataset.inView = 'true';
		return {};
	}

	const io = new IntersectionObserver(
		([entry]) => {
			if (entry.isIntersecting) {
				node.dataset.inView = 'true';
				io.disconnect();
			}
		},
		{ rootMargin, threshold }
	);

	io.observe(node);

	return {
		destroy() {
			io.disconnect();
		}
	};
}
