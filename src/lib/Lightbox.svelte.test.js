import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import Lightbox from './Lightbox.svelte';
import { lightboxStore } from './lightbox.js';

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
