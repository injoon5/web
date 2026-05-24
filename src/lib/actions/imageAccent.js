/** Sets --accent (r g b) from the first <img> for a soft colored shadow. */
export function imageAccent(node) {
	const img = node.querySelector('img');
	if (!img) return;

	img.crossOrigin = 'anonymous';

	function apply() {
		try {
			const size = 8;
			const canvas = document.createElement('canvas');
			canvas.width = size;
			canvas.height = size;
			const ctx = canvas.getContext('2d');
			ctx.drawImage(img, 0, 0, size, size);
			const data = ctx.getImageData(0, 0, size, size).data;
			let r = 0;
			let g = 0;
			let b = 0;
			let n = 0;
			for (let i = 0; i < data.length; i += 4) {
				r += data[i];
				g += data[i + 1];
				b += data[i + 2];
				n++;
			}
			if (!n) return;
			node.style.setProperty('--accent', `${(r / n) | 0} ${(g / n) | 0} ${(b / n) | 0}`);
		} catch {
			// cross-origin or other canvas errors — fall back to default shadow in CSS
		}
	}

	if (img.complete) apply();
	else img.addEventListener('load', apply, { once: true });

	return {};
}
