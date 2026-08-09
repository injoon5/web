import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import Lightbox from './Lightbox.svelte';
import { lightboxStore, lightboxAction, openLightbox } from './store.svelte.js';

const openValue = {
	src: 'https://example.com/cat.jpg',
	alt: 'A cat',
	naturalWidth: 800,
	naturalHeight: 600
};

beforeEach(() => lightboxStore.set(null));
afterEach(() => lightboxStore.set(null));

describe('Lightbox rendering', () => {
	it('renders nothing while closed', () => {
		render(Lightbox);
		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('renders the image, caption and close button when opened', async () => {
		render(Lightbox);
		lightboxStore.set(openValue);
		await tick();

		expect(await screen.findByRole('dialog')).toBeInTheDocument();
		expect(screen.getByRole('img', { name: 'A cat' })).toHaveAttribute('src', openValue.src);
		expect(screen.getByRole('button', { name: 'Close image' })).toBeInTheDocument();
		expect(screen.getByText('A cat')).toBeInTheDocument();
	});
});

// Three things can occupy the image's box, and only ever one at a time: the
// photo itself, the pixels the article already had, or the placeholder. What is
// being tested here is which one, and when.
describe('Lightbox placeholder', () => {
	it('paints the pixels the page already has under its own copy', async () => {
		render(Lightbox);
		lightboxStore.set({ ...openValue, poster: openValue.src, ready: true });
		await tick();

		const img = screen.getByRole('img', { name: 'A cat' });
		expect(img.style.backgroundImage).toBe(`url("${openValue.src}")`);
		// There is a photo on screen, so there is nothing for a placeholder to do.
		expect(img).not.toHaveAttribute('data-img-pending');
	});

	it('shows a placeholder when no copy of the image exists on the page', async () => {
		render(Lightbox);
		lightboxStore.set(openValue);
		await tick();

		const img = screen.getByRole('img', { name: 'A cat' });
		// A known natural size means the box is the real one, so the placeholder is
		// exactly where the photo will be.
		expect(img).toHaveAttribute('data-img-pending', 'true');
		expect(img.style.width).toBe('800px');
		expect(img.style.height).toBe('600px');
	});

	it('drops both the moment its own copy lands', async () => {
		render(Lightbox);
		lightboxStore.set({ ...openValue, poster: openValue.src });
		await tick();

		const img = screen.getByRole('img', { name: 'A cat' });
		img.dispatchEvent(new Event('load'));
		await tick();

		expect(img).not.toHaveAttribute('data-img-pending');
		expect(img.style.backgroundImage).toBe('');
	});

	// Nothing holding the box and nothing to put in it: the old behaviour, kept
	// for the one case it was written for.
	it('fades in from nothing when there is no box at all', async () => {
		render(Lightbox);
		lightboxStore.set({ src: 'https://example.com/unknown.jpg', alt: 'Unknown' });
		await tick();

		const img = screen.getByRole('img', { name: 'Unknown' });
		expect(img.className).toContain('pending');
		expect(img).not.toHaveAttribute('data-img-pending');
	});

	// `data-lightbox-src` is a second, larger file, so its size is not known — but
	// the thumbnail's shape is, and a box of the right shape is what the article's
	// own pixels need to be painted into.
	it('sizes an unmeasured image from the shape of the one on the page', async () => {
		render(Lightbox);
		lightboxStore.set({
			src: 'https://example.com/full.jpg',
			alt: 'Big',
			poster: 'https://example.com/thumb.jpg',
			posterWidth: 400,
			posterHeight: 200
		});
		await tick();

		const img = screen.getByRole('img', { name: 'Big' });
		expect(img.style.backgroundImage).toBe('url("https://example.com/thumb.jpg")');
		expect(img.style.width).not.toBe('');
		// 2:1, whatever the viewport made of it.
		expect(Number.parseFloat(img.style.width) / Number.parseFloat(img.style.height)).toBeCloseTo(
			2,
			1
		);
	});
});

describe('Lightbox focus management', () => {
	it('moves focus to the close button on open', async () => {
		render(Lightbox);
		lightboxStore.set(openValue);
		await tick();

		const closeBtn = screen.getByRole('button', { name: 'Close image' });
		await waitFor(() => expect(document.activeElement).toBe(closeBtn));
	});

	it('restores focus to the opener element on close', async () => {
		const trigger = document.createElement('button');
		document.body.appendChild(trigger);
		trigger.focus();

		render(Lightbox);
		lightboxStore.set(openValue);
		await tick();
		const closeBtn = screen.getByRole('button', { name: 'Close image' });
		await waitFor(() => expect(document.activeElement).toBe(closeBtn));

		// Closing must return focus to the original trigger — not leave it on the
		// (now unmounted) close button. Regression guard for the focus-recapture fix.
		lightboxStore.set(null);
		await tick();
		await waitFor(() => expect(document.activeElement).toBe(trigger));

		trigger.remove();
	});
});

describe('Lightbox theme-color', () => {
	function addThemeMetas() {
		const light = document.createElement('meta');
		light.setAttribute('name', 'theme-color');
		light.setAttribute('content', '#ffffff');
		light.setAttribute('media', '(prefers-color-scheme: light)');
		const dark = document.createElement('meta');
		dark.setAttribute('name', 'theme-color');
		dark.setAttribute('content', '#000000');
		dark.setAttribute('media', '(prefers-color-scheme: dark)');
		document.head.append(light, dark);
		return { light, dark };
	}

	it('darkens the browser chrome while open and restores it on close', async () => {
		const { light, dark } = addThemeMetas();
		try {
			render(Lightbox);
			lightboxStore.set(openValue);
			await tick();

			// Both metas forced dark with the media gate dropped so it wins in any scheme.
			await waitFor(() => {
				expect(light.getAttribute('content')).toBe('#0a0a0a');
				expect(light.hasAttribute('media')).toBe(false);
				expect(dark.getAttribute('content')).toBe('#0a0a0a');
			});

			lightboxStore.set(null);
			await tick();

			await waitFor(() => {
				expect(light.getAttribute('content')).toBe('#ffffff');
				expect(light.getAttribute('media')).toBe('(prefers-color-scheme: light)');
				expect(dark.getAttribute('content')).toBe('#000000');
				expect(dark.getAttribute('media')).toBe('(prefers-color-scheme: dark)');
			});
		} finally {
			light.remove();
			dark.remove();
		}
	});
});

const group = [
	{ src: 'https://example.com/one.jpg', alt: 'One', naturalWidth: 800, naturalHeight: 600 },
	{ src: 'https://example.com/two.jpg', alt: 'Two', naturalWidth: 800, naturalHeight: 600 },
	{ src: 'https://example.com/three.jpg', alt: 'Three', naturalWidth: 800, naturalHeight: 600 }
];

// Every image in the group is a slide on one track — the swipe slides the track
// rather than swapping the element — so "the image" is the one marked current.
const currentSrc = () =>
	screen.getByRole('dialog').querySelector('.lb-img[data-current="true"]').getAttribute('src');
const slides = () => screen.getByRole('dialog').querySelectorAll('.lb-slide');
const loadedSrcs = () =>
	Array.from(screen.getByRole('dialog').querySelectorAll('.lb-img')).map((i) =>
		i.getAttribute('src')
	);
const steps = () => screen.getByRole('dialog').querySelectorAll('.pasito-step');
const activeStep = () =>
	Array.from(steps()).findIndex((s) => s.classList.contains('pasito-step-active'));

async function openGroup(index = 0) {
	render(Lightbox);
	lightboxStore.set({ items: group.map((i) => ({ ...i })), index });
	await tick();
	await screen.findByRole('dialog');
}

describe('Lightbox single image', () => {
	it('still accepts a bare image and shows no group chrome for it', async () => {
		render(Lightbox);
		lightboxStore.set(openValue);
		await tick();

		expect(await screen.findByRole('dialog')).toBeInTheDocument();
		expect(steps()).toHaveLength(0);
		expect(screen.queryByRole('button', { name: 'Next image' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Previous image' })).toBeNull();
	});
});

describe('Lightbox groups', () => {
	it('opens on the clicked image and steps once per image', async () => {
		await openGroup(1);
		expect(currentSrc()).toBe(group[1].src);
		expect(steps()).toHaveLength(3);
		expect(activeStep()).toBe(1);
	});

	it('names its position for screen readers', async () => {
		await openGroup(1);
		expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Two — 2 of 3');
	});

	it('pages with the arrow buttons', async () => {
		await openGroup(0);

		screen.getByRole('button', { name: 'Next image' }).click();
		await tick();
		expect(currentSrc()).toBe(group[1].src);
		expect(activeStep()).toBe(1);

		screen.getByRole('button', { name: 'Previous image' }).click();
		await tick();
		expect(currentSrc()).toBe(group[0].src);
	});

	it('disables the arrows at the ends rather than wrapping', async () => {
		await openGroup(0);
		expect(screen.getByRole('button', { name: 'Previous image' })).toBeDisabled();
		expect(screen.getByRole('button', { name: 'Next image' })).not.toBeDisabled();

		screen.getByRole('button', { name: 'Next image' }).click();
		screen.getByRole('button', { name: 'Next image' }).click();
		await tick();
		expect(currentSrc()).toBe(group[2].src);
		expect(screen.getByRole('button', { name: 'Next image' })).toBeDisabled();
	});

	it('pages with the arrow keys', async () => {
		await openGroup(0);

		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
		await tick();
		expect(currentSrc()).toBe(group[1].src);

		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
		await tick();
		expect(currentSrc()).toBe(group[0].src);
	});

	it('jumps to a step when its dot is clicked', async () => {
		await openGroup(0);
		steps()[2].click();
		await tick();
		expect(currentSrc()).toBe(group[2].src);
		expect(activeStep()).toBe(2);
	});

	it('shows the caption of the image it is on', async () => {
		await openGroup(0);
		expect(screen.getByText('One')).toBeInTheDocument();
		steps()[2].click();
		await tick();
		expect(screen.getByText('Three')).toBeInTheDocument();
		expect(screen.queryByText('One')).toBeNull();
	});

	it('leaves Escape closing the whole thing, not just the step', async () => {
		await openGroup(1);
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
	});

	it('jumps to either end with Home and End', async () => {
		await openGroup(1);

		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
		await tick();
		expect(currentSrc()).toBe(group[2].src);

		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
		await tick();
		expect(currentSrc()).toBe(group[0].src);
	});

	it('lays the whole group out as one track so a swipe has somewhere to go', async () => {
		await openGroup(1);
		expect(slides()).toHaveLength(3);
		// ...but only the neighbours are fetched. Opening a gallery of forty must
		// not pull forty images over the wire.
		expect(loadedSrcs()).toEqual(group.map((i) => i.src));

		lightboxStore.set({
			items: [...group, ...group].map((i, n) => ({ ...i, src: `${i.src}#${n}` })),
			index: 0
		});
		await tick();
		expect(slides()).toHaveLength(6);
		expect(loadedSrcs()).toHaveLength(2);
	});

	it('hides every slide but the current one from assistive tech', async () => {
		await openGroup(1);
		const hidden = Array.from(slides()).map((s) => s.getAttribute('aria-hidden'));
		expect(hidden).toEqual(['true', null, 'true']);
	});
});

describe('Lightbox swipe paging', () => {
	const track = () => screen.getByRole('dialog').querySelector('.lb-track');

	/** jsdom has no PointerEvent, and the component only reads these four fields. */
	function pointer(type, x, y, t, id = 1) {
		const e = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 });
		Object.defineProperty(e, 'pointerId', { value: id });
		Object.defineProperty(e, 'pointerType', { value: 'touch' });
		Object.defineProperty(e, 'timeStamp', { value: t });
		return e;
	}

	/**
	 * A drag as a real pointer stream: one event every few ms, which is what the
	 * windowed velocity is measured over. `hold` is a pause between the last move
	 * and the release — a finger that came to rest is not a flick, however fast it
	 * was travelling on the way.
	 */
	async function drag({ dx, ms, steps = 8, hold = 0 }) {
		const viewport = screen.getByRole('dialog').querySelector('.lb-viewport');
		viewport.dispatchEvent(pointer('pointerdown', 0, 0, 0));
		for (let i = 1; i <= steps; i++) {
			window.dispatchEvent(pointer('pointermove', (dx * i) / steps, 0, (ms * i) / steps));
		}
		window.dispatchEvent(pointer('pointerup', dx, 0, ms + hold));
		await tick();
	}

	it('pages on a flick that barely moved, and not on a slow drag that did not', async () => {
		await openGroup(0);
		// 30px in 40ms — 0.75px/ms, well past the flick threshold.
		await drag({ dx: -30, ms: 40 });
		expect(currentSrc()).toBe(group[1].src);

		// 100px in 800ms — under a fifth of the viewport and far too slow to flick.
		await drag({ dx: -100, ms: 800, steps: 20 });
		expect(currentSrc()).toBe(group[1].src);
	});

	it('does not page a fast drag that came to rest before the finger lifted', async () => {
		// Velocity is measured over a window ending at the release, so samples from
		// a fling that stopped 300ms ago fall out of it. A single-sample velocity
		// read off the last pointermove would have paged here.
		await openGroup(0);
		await drag({ dx: -60, ms: 60, hold: 300 });
		expect(currentSrc()).toBe(group[0].src);
	});

	it('gives the released swipe a settle of its own, and hands the track back after', async () => {
		await openGroup(0);
		expect(track().style.transition).toContain('340ms');

		await drag({ dx: -400, ms: 200, steps: 16 });
		expect(currentSrc()).toBe(group[1].src);
		// Its own duration, scaled to the distance still to travel.
		const settle = track().style.transition;
		expect(settle).toMatch(/^transform (\d+)ms /);
		const ms = Number(settle.match(/^transform (\d+)ms /)[1]);
		expect(ms).toBeGreaterThanOrEqual(190);
		// Strictly under the shared curve's 340: most of the page is already behind
		// the finger, so there is less of it left to travel.
		expect(ms).toBeLessThan(340);

		// ...and the next arrow key must not inherit this swipe's velocity.
		await new Promise((r) => setTimeout(r, ms + 120));
		expect(track().style.transition).toContain('340ms');
	});

	it('rubber-bands rather than paging off the end of the group', async () => {
		await openGroup(0);
		await drag({ dx: 400, ms: 200, steps: 16 });
		expect(currentSrc()).toBe(group[0].src);
	});

	it('moves the track with a trackpad swipe instead of jumping a page at 80px', async () => {
		await openGroup(0);
		const viewport = screen.getByRole('dialog').querySelector('.lb-viewport');
		const wheel = (deltaX) =>
			viewport.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaX, deltaY: 0 }));

		wheel(30);
		await tick();
		// Following the fingers, and no transition fighting them for the track.
		expect(track().style.transition).toBe('none');
		expect(currentSrc()).toBe(group[0].src);

		for (let i = 0; i < 9; i++) wheel(30);
		await tick();
		expect(currentSrc()).toBe(group[0].src);

		// The gesture is over when the events stop, not when a finger lifts.
		await waitFor(() => expect(currentSrc()).toBe(group[1].src));
		expect(track().style.transition).not.toBe('none');
	});
});

describe('Lightbox shared-element flight', () => {
	/**
	 * jsdom has no layout and no `Element.animate`, so the flight itself cannot
	 * run here — but the half that makes it read as one photo rather than two
	 * can: the copy on the page is hidden for exactly as long as the lightbox is
	 * showing it.
	 */
	function pageImage() {
		const img = document.createElement('img');
		img.src = 'https://example.com/cat.jpg';
		img.alt = 'A cat';
		document.body.appendChild(img);
		return img;
	}

	it('hides the image it flew from, and gives it back on close', async () => {
		const img = pageImage();
		render(Lightbox);
		lightboxStore.set({ items: [{ ...openValue, el: img }], index: 0 });
		await tick();
		await screen.findByRole('dialog');

		await waitFor(() => expect(img.style.visibility).toBe('hidden'));

		lightboxStore.set(null);
		await tick();
		await waitFor(() => expect(img.style.visibility).toBe(''));
		img.remove();
	});

	it('hides only the image it is on, and swaps as the group is paged', async () => {
		const a = pageImage();
		const b = pageImage();
		render(Lightbox);
		lightboxStore.set({
			items: [
				{ ...group[0], el: a },
				{ ...group[1], el: b }
			],
			index: 0
		});
		await tick();
		await screen.findByRole('dialog');
		await waitFor(() => expect(a.style.visibility).toBe('hidden'));
		expect(b.style.visibility).toBe('');

		screen.getByRole('button', { name: 'Next image' }).click();
		await tick();
		await waitFor(() => expect(b.style.visibility).toBe('hidden'));
		expect(a.style.visibility).toBe('');

		lightboxStore.set(null);
		await tick();
		await waitFor(() => expect(b.style.visibility).toBe(''));
		a.remove();
		b.remove();
	});

	it('still opens from a bare store value, which carries no element to fly from', async () => {
		render(Lightbox);
		lightboxStore.set(openValue);
		await tick();
		expect(await screen.findByRole('dialog')).toBeInTheDocument();
	});
});

describe('Lightbox open and close bookkeeping', () => {
	it('does not open on an empty group', async () => {
		render(Lightbox);
		lightboxStore.set({ items: [], index: 0 });
		await tick();
		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('survives a reopen inside the close window', async () => {
		// Closing schedules an unmount. Reopening before that timer fires used to
		// be shut straight back down by it.
		render(Lightbox);
		lightboxStore.set(openValue);
		await tick();
		await screen.findByRole('dialog');

		screen.getByRole('button', { name: 'Close image' }).click();
		await tick();
		lightboxStore.set({ ...openValue, alt: 'A second cat' });
		await tick();

		await new Promise((r) => setTimeout(r, 400));
		expect(screen.queryByRole('dialog')).toBeInTheDocument();
		expect(screen.getByText('A second cat')).toBeInTheDocument();
	});

	it('lets a close that cannot fly keep its own exit animation', async () => {
		// One flag used to mean both "this open flew" and "a flight home is
		// running", so a close with nowhere to fly to lost its exit entirely.
		render(Lightbox);
		lightboxStore.set(openValue);
		await tick();
		const dialog = await screen.findByRole('dialog');

		screen.getByRole('button', { name: 'Close image' }).click();
		await tick();
		expect(dialog).toHaveClass('closing');
		expect(dialog).not.toHaveClass('flying-home');
	});
});

describe('Lightbox modality', () => {
	it('locks the page behind it and gives it back on close', async () => {
		render(Lightbox);
		lightboxStore.set(openValue);
		await tick();
		await screen.findByRole('dialog');
		expect(document.body.style.overflow).toBe('hidden');

		lightboxStore.set(null);
		await tick();
		await waitFor(() => expect(document.body.style.overflow).toBe(''));
	});

	it('renders into <body>, where no ancestor can trap a fixed backdrop', async () => {
		const { container } = render(Lightbox);
		lightboxStore.set(openValue);
		await tick();

		const dialog = await screen.findByRole('dialog');
		expect(dialog.parentElement).toBe(document.body);
		expect(container.contains(dialog)).toBe(false);
	});

	it('inerts the rest of the page while open, and only while open', async () => {
		const sibling = document.createElement('div');
		document.body.appendChild(sibling);

		render(Lightbox);
		lightboxStore.set(openValue);
		await tick();
		await screen.findByRole('dialog');
		await waitFor(() => expect(sibling).toHaveAttribute('inert'));
		expect(sibling).toHaveAttribute('aria-hidden', 'true');

		lightboxStore.set(null);
		await tick();
		await waitFor(() => expect(sibling).not.toHaveAttribute('inert'));
		expect(sibling).not.toHaveAttribute('aria-hidden');

		sibling.remove();
	});
});

describe('lightboxAction', () => {
	function mount(html) {
		const node = document.createElement('div');
		node.innerHTML = html;
		document.body.appendChild(node);
		const handle = lightboxAction(node);
		return { node, destroy: () => (handle.destroy(), node.remove()) };
	}

	/** jsdom never loads images, so natural size has to be planted. */
	function size(img, w = 800, h = 600) {
		Object.defineProperty(img, 'naturalWidth', { value: w, configurable: true });
		Object.defineProperty(img, 'naturalHeight', { value: h, configurable: true });
	}

	/** `img.src` reads back resolved, in a browser as much as in jsdom. */
	const abs = (path) => new URL(path, location.href).href;

	it('opens a lone image as a group of one', () => {
		const { node, destroy } = mount('<img src="/a.png" alt="A">');
		const img = node.querySelector('img');
		size(img);
		img.click();

		const value = lightboxStore.value;
		expect(value.items).toHaveLength(1);
		expect(value.items[0]).toMatchObject({ src: abs('/a.png'), alt: 'A' });
		destroy();
	});

	it('opens a grouped image as the whole group, at the one clicked', () => {
		const { node, destroy } = mount(
			'<div data-lightbox-group><img src="/a.png" alt="A"><img src="/b.png" alt="B"><img src="/c.png" alt="C"></div>'
		);
		node.querySelectorAll('img').forEach((i) => size(i));
		node.querySelectorAll('img')[1].click();

		const value = lightboxStore.value;
		expect(value.items.map((i) => i.src)).toEqual([abs('/a.png'), abs('/b.png'), abs('/c.png')]);
		expect(value.index).toBe(1);
		destroy();
	});

	it('opens a grouped image even when it is too small to open on its own', () => {
		const { node, destroy } = mount(
			'<div data-lightbox-group><img src="/a.png" alt="A"><img src="/b.png" alt="B"></div>'
		);
		node.querySelectorAll('img').forEach((i) => size(i, 20, 20));
		node.querySelectorAll('img')[0].click();

		const value = lightboxStore.value;
		expect(value.items).toHaveLength(2);
		destroy();
	});

	it('still ignores tiny standalone images and linked ones', () => {
		const { node, destroy } = mount(
			'<img src="/icon.png" alt="i"><a href="/x"><img src="/linked.png" alt="l"></a>'
		);
		const [icon, linked] = node.querySelectorAll('img');
		size(icon, 20, 20);
		size(linked);
		icon.click();
		linked.click();

		const value = lightboxStore.value;
		expect(value).toBeNull();
		destroy();
	});

	it('carries the element each image came from, so the lightbox can fly back to it', () => {
		const { node, destroy } = mount(
			'<div data-lightbox-group><img src="/a.png" alt="A"><img src="/b.png" alt="B"></div>'
		);
		const imgs = Array.from(node.querySelectorAll('img'));
		imgs.forEach((i) => size(i));
		imgs[1].click();

		const value = lightboxStore.value;
		expect(value.items.map((i) => i.el)).toEqual(imgs);
		destroy();
	});

	it('makes every image in the container lazy', () => {
		const { node, destroy } = mount('<img src="/a.png" alt="A"><img src="/b.png" alt="B">');
		expect(
			Array.from(node.querySelectorAll('img')).every((i) => i.getAttribute('loading') === 'lazy')
		).toBe(true);
		destroy();
	});

	// The build stamps the file's real dimensions on the element, so an image the
	// reader clicks while it is still downloading opens into the box it is going
	// to fill — and the flight has something to fly to. Before this it opened at
	// nothing and resized when the bytes landed.
	it('takes the size off the build-time attributes when nothing has loaded', () => {
		const { node, destroy } = mount('<img src="/a.png" alt="A" width="1600" height="900">');
		node.querySelector('img').click();

		expect(lightboxStore.value.items[0]).toMatchObject({
			naturalWidth: 1600,
			naturalHeight: 900
		});
		destroy();
	});

	it('prefers what the browser has actually decoded over the attributes', () => {
		const { node, destroy } = mount('<img src="/a.png" alt="A" width="1600" height="900">');
		const img = node.querySelector('img');
		size(img, 800, 600);
		img.click();

		expect(lightboxStore.value.items[0]).toMatchObject({
			naturalWidth: 800,
			naturalHeight: 600
		});
		destroy();
	});

	it('does not read the article file as the size of a different lightbox file', () => {
		const { node, destroy } = mount(
			'<img src="/thumb.png" data-lightbox-src="/full.png" alt="A" width="400" height="300">'
		);
		const img = node.querySelector('img');
		size(img, 400, 300);
		img.click();

		const item = lightboxStore.value.items[0];
		expect(item.src).toBe('/full.png');
		// Unknown, because nothing has measured that file — but the shape is not.
		expect(item.naturalWidth).toBe(0);
		expect(item.posterWidth).toBe(400);
		destroy();
	});
});

describe('openLightbox', () => {
	it('clamps the index into the group', () => {
		openLightbox(group, 99);
		const value = lightboxStore.value;
		expect(value.index).toBe(2);
	});

	it('does nothing when handed nothing', () => {
		openLightbox([]);
		const value = lightboxStore.value;
		expect(value).toBeNull();
	});
});
