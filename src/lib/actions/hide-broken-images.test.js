import { describe, it, expect, beforeAll } from 'vitest';
import { hideBrokenImages } from './hide-broken-images.js';

/** Just enough of an <img> for the action: attributes and load state. */
class FakeImage extends EventTarget {
	constructor({ complete = false, naturalWidth = 0 } = {}) {
		super();
		this.complete = complete;
		this.naturalWidth = naturalWidth;
		this.attrs = new Map([['src', 'https://example.com/cover.jpg']]);
	}
	setAttribute(k, v) {
		this.attrs.set(k, v);
	}
	getAttribute(k) {
		return this.attrs.get(k) ?? null;
	}
	hasAttribute(k) {
		return this.attrs.has(k);
	}
}

/** A container that dispatches capture-phase listeners for its images' events. */
function fakeContainer(images) {
	const listeners = [];
	return {
		querySelectorAll: () => images,
		addEventListener: (type, fn) => listeners.push([type, fn]),
		removeEventListener: (type, fn) =>
			listeners.splice(
				listeners.findIndex(([, f]) => f === fn),
				1
			),
		/** @param {FakeImage} img */
		fail(img) {
			for (const [type, fn] of listeners) if (type === 'error') fn({ target: img });
		}
	};
}

beforeAll(() => {
	// The action checks `instanceof HTMLImageElement`; node has no DOM.
	globalThis.HTMLImageElement = FakeImage;
});

describe('hideBrokenImages', () => {
	it('marks an image in the container when it fails to load', () => {
		const img = new FakeImage();
		const box = fakeContainer([img]);
		hideBrokenImages(box);
		expect(img.hasAttribute('data-broken')).toBe(false);
		box.fail(img);
		expect(img.hasAttribute('data-broken')).toBe(true);
	});

	it('marks an image that had already failed, and leaves a loaded one alone', () => {
		const failed = new FakeImage({ complete: true, naturalWidth: 0 });
		const loaded = new FakeImage({ complete: true, naturalWidth: 300 });
		hideBrokenImages(fakeContainer([failed, loaded]));
		expect(failed.hasAttribute('data-broken')).toBe(true);
		expect(loaded.hasAttribute('data-broken')).toBe(false);
	});

	it('stops listening when destroyed', () => {
		const img = new FakeImage();
		const box = fakeContainer([img]);
		hideBrokenImages(box).destroy();
		box.fail(img);
		expect(img.hasAttribute('data-broken')).toBe(false);
	});
});
