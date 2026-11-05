import { describe, it, expect } from 'vitest';
import { hideIfBroken } from './hide-if-broken.js';

/** Just enough of an <img> for the action: events, attributes, load state. */
function fakeImage({ complete = false, naturalWidth = 0 } = {}) {
	const attrs = new Map([['src', 'https://example.com/cover.jpg']]);
	return Object.assign(new EventTarget(), {
		complete,
		naturalWidth,
		setAttribute: (k, v) => attrs.set(k, v),
		getAttribute: (k) => attrs.get(k) ?? null,
		hasAttribute: (k) => attrs.has(k)
	});
}

describe('hideIfBroken', () => {
	it('marks an image when it fails to load', () => {
		const img = fakeImage();
		hideIfBroken(img);
		expect(img.hasAttribute('data-broken')).toBe(false);
		img.dispatchEvent(new Event('error'));
		expect(img.hasAttribute('data-broken')).toBe(true);
	});

	it('marks an image that had already failed before it was mounted', () => {
		const img = fakeImage({ complete: true, naturalWidth: 0 });
		hideIfBroken(img);
		expect(img.hasAttribute('data-broken')).toBe(true);
	});

	it('leaves a loaded image alone, and stops listening when destroyed', () => {
		const loaded = fakeImage({ complete: true, naturalWidth: 300 });
		hideIfBroken(loaded);
		expect(loaded.hasAttribute('data-broken')).toBe(false);

		const img = fakeImage();
		hideIfBroken(img).destroy();
		img.dispatchEvent(new Event('error'));
		expect(img.hasAttribute('data-broken')).toBe(false);
	});
});
