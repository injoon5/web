import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import Gallery from './Gallery.svelte';

const images = [
	{ src: '/a.png', alt: 'One' },
	{ src: '/b.png', alt: 'Two' },
	{ src: '/c.png', alt: 'Three' }
];

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
		const track = container.querySelector('.gallery-track');

		// jsdom lays nothing out, so stand in for the geometry the handler reads.
		const scrollTo = vi.fn();
		track.scrollTo = scrollTo;
		Object.defineProperty(track, 'clientWidth', { value: 300, configurable: true });
		Array.from(track.children).forEach((slide, i) => {
			Object.defineProperty(slide, 'offsetLeft', { value: i * 300, configurable: true });
			Object.defineProperty(slide, 'offsetWidth', { value: 300, configurable: true });
		});

		container.querySelectorAll('.pasito-step')[2].click();
		await tick();

		expect(scrollTo).toHaveBeenCalledWith({ left: 600, behavior: 'smooth' });
	});

	it('follows the scroll position with the active step', async () => {
		const { container } = render(Gallery, { images });
		const track = container.querySelector('.gallery-track');

		Object.defineProperty(track, 'clientWidth', { value: 300, configurable: true });
		Array.from(track.children).forEach((slide, i) => {
			Object.defineProperty(slide, 'offsetLeft', { value: i * 300, configurable: true });
			Object.defineProperty(slide, 'offsetWidth', { value: 300, configurable: true });
		});
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
