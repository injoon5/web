import { describe, it, expect } from 'vitest';
import { srcsetOf, variantKey, variantPath, variantWidths } from './image-variants.js';

describe('variantWidths', () => {
	it('offers the steps below a photo, none within 15% of it, and none above', () => {
		expect(variantWidths(2400)).toEqual([640, 960, 1280, 1920]);
		expect(variantWidths(1100)).toEqual([640]);
		expect(variantWidths(1000)).toEqual([640]);
		expect(variantWidths(600)).toEqual([]);
	});
});

describe('variantPath and variantKey', () => {
	it('names a copy after its photo, its width and a key', () => {
		expect(variantPath('static/images/a/photo.jpeg', 960, 'abc')).toBe(
			'static/images/a/photo.w960.abc.webp'
		);
		expect(variantPath('static/images/a.b/shot.final.png', 640, 'k')).toBe(
			'static/images/a.b/shot.final.w640.k.webp'
		);
	});

	it('changes the key with the source and the width, so an immutable URL is never reused', () => {
		const key = variantKey('hash-a', 960);
		expect(key).toMatch(/^[0-9a-f]{10}$/);
		expect(variantKey('hash-a', 960)).toBe(key);
		expect(variantKey('hash-b', 960)).not.toBe(key);
		expect(variantKey('hash-a', 640)).not.toBe(key);
	});
});

describe('srcsetOf', () => {
	it('lists candidates with their widths, escaping what would split one', () => {
		const srcset = srcsetOf({
			width: 2400,
			height: 1600,
			candidates: [
				{ url: '/images/uploads/초과의날 (1).w640.k.webp', w: 640 },
				{ url: '/images/a,b.png', w: 2400 }
			]
		});
		expect(srcset).toBe('/images/uploads/초과의날%20(1).w640.k.webp 640w, /images/a%2Cb.png 2400w');
	});
});
