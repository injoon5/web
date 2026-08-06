import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import Gallery from './Gallery.svelte';

const images = [
	{ src: '/a.png', alt: 'One' },
	{ src: '/b.png', alt: 'Two' },
	{ src: '/c.png', alt: 'Three' }
];

/** jsdom lays nothing out, so stand in for the geometry the handlers read. */
function layOut(container, slideWidth = 300) {
	const track = container.querySelector('.gallery-track');
	track.scrollTo = vi.fn();
	Object.defineProperty(track, 'clientWidth', { value: slideWidth, configurable: true });
	Array.from(track.children).forEach((slide, i) => {
		Object.defineProperty(slide, 'offsetLeft', { value: i * slideWidth, configurable: true });
		Object.defineProperty(slide, 'offsetWidth', { value: slideWidth, configurable: true });
	});
	return track;
}

describe('Gallery', () => {
	it('renders every image in order, lazily', () => {
		const { container } = render(Gallery, { images });
		const imgs = Array.from(container.querySelectorAll('img'));
		expect(imgs.map((i) => i.getAttribute('src'))).toEqual(['/a.png', '/b.png', '/c.png']);
		expect(imgs.map((i) => i.alt)).toEqual(['One', 'Two', 'Three']);
		expect(imgs.every((i) => i.getAttribute('loading') === 'lazy')).toBe(true);
	});

	it('marks the strip as one lightbox group', () => {
		const { container } = render(Gallery, { images });
		const track = container.querySelector('[data-lightbox-group]');
		expect(track).toBeInTheDocument();
		expect(track.querySelectorAll('img')).toHaveLength(3);
	});

	it('shows a stepper with one step per image', () => {
		const { container } = render(Gallery, { images });
		expect(container.querySelectorAll('.pasito-step')).toHaveLength(3);
		expect(container.querySelector('.pasito-step')).toHaveClass('pasito-step-active');
	});

	it('shows no stepper for a single image — there is nowhere to step', () => {
		const { container } = render(Gallery, { images: images.slice(0, 1) });
		expect(container.querySelectorAll('.pasito-step')).toHaveLength(0);
	});

	it('captions the active image, preferring its title', async () => {
		const { container } = render(Gallery, {
			images: [{ src: '/a.png', alt: 'One', title: 'Golden hour' }, images[1]]
		});
		expect(container.querySelector('.gallery-caption')).toHaveTextContent('Golden hour');
	});

	it('scrolls the strip when a step is clicked', async () => {
		const { container } = render(Gallery, { images });
		const track = layOut(container);

		container.querySelectorAll('.pasito-step')[2].click();
		await tick();

		expect(track.scrollTo).toHaveBeenCalledWith({ left: 600, behavior: 'smooth' });
	});

	it('steps a whole slide on the arrow keys, not the browser default nudge', async () => {
		const { container } = render(Gallery, { images });
		const track = layOut(container);

		track.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
		expect(track.scrollTo).toHaveBeenCalledWith({ left: 300, behavior: 'smooth' });

		track.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
		expect(track.scrollTo).toHaveBeenLastCalledWith({ left: 600, behavior: 'smooth' });
	});

	it('does not step past either end', async () => {
		const { container } = render(Gallery, { images });
		const track = layOut(container);

		track.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
		expect(track.scrollTo).toHaveBeenCalledWith({ left: 0, behavior: 'smooth' });
	});

	it('swallows the click that ends a swipe — a drag is not a tap', () => {
		const { container } = render(Gallery, { images });
		const track = container.querySelector('.gallery-track');
		const onAncestorClick = vi.fn();
		container.addEventListener('click', onAncestorClick);

		// A tap: pressed and released in the same place. The lightbox should see it.
		track.dispatchEvent(
			new PointerEvent('pointerdown', { clientX: 100, clientY: 40, bubbles: true })
		);
		track.dispatchEvent(new MouseEvent('click', { clientX: 100, clientY: 40, bubbles: true }));
		expect(onAncestorClick).toHaveBeenCalledTimes(1);

		// A swipe: the click that follows it is not an intent to open anything.
		track.dispatchEvent(
			new PointerEvent('pointerdown', { clientX: 240, clientY: 40, bubbles: true })
		);
		track.dispatchEvent(new MouseEvent('click', { clientX: 100, clientY: 40, bubbles: true }));
		expect(onAncestorClick).toHaveBeenCalledTimes(1);

		// A click no pointer began — synthetic, keyboard, assistive tech — has no
		// press to be measured against, and must never be read as a swipe.
		track.querySelector('img').click();
		expect(onAncestorClick).toHaveBeenCalledTimes(2);
	});

	it('follows the scroll position with the active step', async () => {
		const { container } = render(Gallery, { images });
		const track = layOut(container);
		track.scrollLeft = 600;
		track.dispatchEvent(new Event('scroll'));

		await vi.waitFor(() => {
			const steps = container.querySelectorAll('.pasito-step');
			expect(steps[2]).toHaveClass('pasito-step-active');
			expect(steps[0]).not.toHaveClass('pasito-step-active');
		});
		expect(screen.getByText('Three')).toBeInTheDocument();
	});
});
