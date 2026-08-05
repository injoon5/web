import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import Lightbox from './Lightbox.svelte';
import { lightboxStore, lightboxAction, openLightbox } from './lightbox.js';

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

		let value;
		lightboxStore.subscribe((v) => (value = v))();
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

		let value;
		lightboxStore.subscribe((v) => (value = v))();
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

		let value;
		lightboxStore.subscribe((v) => (value = v))();
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

		let value;
		lightboxStore.subscribe((v) => (value = v))();
		expect(value).toBeNull();
		destroy();
	});

	it('makes every image in the container lazy', () => {
		const { node, destroy } = mount('<img src="/a.png" alt="A"><img src="/b.png" alt="B">');
		expect(
			Array.from(node.querySelectorAll('img')).every((i) => i.getAttribute('loading') === 'lazy')
		).toBe(true);
		destroy();
	});
});

describe('openLightbox', () => {
	it('clamps the index into the group', () => {
		openLightbox(group, 99);
		let value;
		lightboxStore.subscribe((v) => (value = v))();
		expect(value.index).toBe(2);
	});

	it('does nothing when handed nothing', () => {
		openLightbox([]);
		let value;
		lightboxStore.subscribe((v) => (value = v))();
		expect(value).toBeNull();
	});
});
