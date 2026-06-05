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
