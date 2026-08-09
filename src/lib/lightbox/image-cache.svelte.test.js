import { describe, it, expect, beforeEach } from 'vitest';
import {
	isLoaded,
	noteImage,
	resetImageCache,
	sizeOf,
	trackImage,
	trackImages
} from './image-cache.js';

/**
 * jsdom never loads anything, so `complete` and `naturalWidth` are set by hand —
 * which is also the distinction the cache is built on: an `<img>` that exists is
 * not an `<img>` that has pixels.
 *
 * `attrs` are the build-time `width`/`height`, which are there long before the
 * pixels are; `loaded` is what the browser has actually decoded.
 */
function img({ src = 'https://example.com/a.jpg', attrs = {}, loaded = null } = {}) {
	const el = document.createElement('img');
	el.setAttribute('src', src);
	Object.defineProperty(el, 'src', { value: src, configurable: true });
	for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, String(value));
	paint(el, loaded);
	return el;
}

/** Give an element pixels, or take them away. */
function paint(el, size) {
	const src = size ? el.src : '';
	Object.defineProperty(el, 'currentSrc', { value: src, configurable: true });
	Object.defineProperty(el, 'complete', { value: Boolean(size), configurable: true });
	Object.defineProperty(el, 'naturalWidth', { value: size?.width ?? 0, configurable: true });
	Object.defineProperty(el, 'naturalHeight', { value: size?.height ?? 0, configurable: true });
}

beforeEach(resetImageCache);

describe('image cache', () => {
	it('remembers what a loaded image is, by URL', () => {
		noteImage(img({ src: 'https://example.com/a.jpg', loaded: { width: 1200, height: 800 } }));
		expect(isLoaded('https://example.com/a.jpg')).toBe(true);
		expect(sizeOf('https://example.com/a.jpg')).toEqual({ width: 1200, height: 800 });
	});

	// The whole point of the module: the lightbox mounts its own element, and has
	// to be able to ask whether these pixels are already on the page before it
	// decides to show an empty box instead.
	it('answers for a URL, not for the element that loaded it', () => {
		noteImage(img({ src: 'https://example.com/a.jpg', loaded: { width: 10, height: 10 } }));
		expect(isLoaded(img({ src: 'https://example.com/a.jpg' }).src)).toBe(true);
	});

	it('ignores an image that has not actually loaded', () => {
		noteImage(img({ src: 'https://example.com/b.jpg' }));
		expect(isLoaded('https://example.com/b.jpg')).toBe(false);
		expect(sizeOf('https://example.com/b.jpg')).toBeNull();
		expect(isLoaded(null)).toBe(false);
		expect(() => noteImage(null)).not.toThrow();
	});

	// A photo essay is a hundred images; the sizes are two numbers each and are
	// kept for all of them, and only the decoded bitmaps are bounded.
	it('keeps every size it has ever been told, past the retention bound', () => {
		for (let i = 0; i < 40; i++) {
			noteImage(img({ src: `https://example.com/${i}.jpg`, loaded: { width: 8, height: 8 } }));
		}
		expect(isLoaded('https://example.com/0.jpg')).toBe(true);
		expect(isLoaded('https://example.com/39.jpg')).toBe(true);
	});
});

describe('trackImage', () => {
	it('holds a placeholder in the box until the image lands', () => {
		const el = img({ src: 'https://example.com/c.jpg', attrs: { width: 1200, height: 800 } });

		trackImage(el);
		expect(el.getAttribute('data-img-pending')).toBe('true');
		expect(el.getAttribute('loading')).toBe('lazy');
		expect(el.getAttribute('decoding')).toBe('async');

		paint(el, { width: 1200, height: 800 });
		el.dispatchEvent(new Event('load'));

		expect(el.hasAttribute('data-img-pending')).toBe(false);
		expect(isLoaded('https://example.com/c.jpg')).toBe(true);
	});

	// An image the browser finished before hydration reached it fires no `load`,
	// and the server-rendered placeholder would sit on top of it forever.
	it('clears a placeholder on an image that had already loaded', () => {
		const el = img({
			src: 'https://example.com/d.jpg',
			attrs: { width: 40, height: 30, 'data-img-pending': 'true' },
			loaded: { width: 40, height: 30 }
		});
		trackImage(el);
		expect(el.hasAttribute('data-img-pending')).toBe(false);
		expect(isLoaded('https://example.com/d.jpg')).toBe(true);
	});

	it('gives the alt text back when the image is broken', () => {
		const el = img({ src: 'https://example.com/e.jpg', attrs: { width: 100, height: 100 } });
		trackImage(el);
		expect(el.getAttribute('data-img-pending')).toBe('true');
		el.dispatchEvent(new Event('error'));
		expect(el.hasAttribute('data-img-pending')).toBe(false);
	});

	// No box means no placeholder: it would be a 0x0 nothing whose only effect is
	// to hide the alt text.
	it('does not mark an image whose size is unknown', () => {
		const el = img({ src: 'https://example.com/f.jpg' });
		trackImage(el);
		expect(el.hasAttribute('data-img-pending')).toBe(false);
	});

	it('leaves attributes the author set alone', () => {
		const el = img({ src: 'https://example.com/g.jpg', attrs: { loading: 'eager' } });
		trackImage(el);
		expect(el.getAttribute('loading')).toBe('eager');
	});

	it('walks a subtree', () => {
		const root = document.createElement('div');
		root.append(
			img({ src: 'https://example.com/h.jpg', loaded: { width: 4, height: 4 } }),
			img({ src: 'https://example.com/i.jpg', loaded: { width: 4, height: 4 } })
		);
		trackImages(root);
		expect(isLoaded('https://example.com/h.jpg')).toBe(true);
		expect(isLoaded('https://example.com/i.jpg')).toBe(true);
		expect(() => trackImages(null)).not.toThrow();
	});
});
