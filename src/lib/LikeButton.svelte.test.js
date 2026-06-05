import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';

// convex-svelte's useQuery needs a live Convex client/context; replace it with a
// controllable stub that returns fixed server state.
vi.mock('convex-svelte', () => ({ useQuery: vi.fn() }));

import { useQuery } from 'convex-svelte';
import { setPage } from '$app/stores';
import LikeButton from './LikeButton.svelte';

beforeEach(() => {
	setPage();
	useQuery.mockReturnValue({
		data: { count: 3, liked: false },
		isStale: false,
		isLoading: false
	});
	vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
});

describe('LikeButton', () => {
	it('shows the server like count and an enabled Like button', async () => {
		render(LikeButton);
		const btn = await screen.findByRole('button', { name: 'Like' });
		await waitFor(() => expect(btn).toBeEnabled());
		expect(btn).toHaveAttribute('aria-pressed', 'false');
		expect(screen.getByText('likes')).toBeInTheDocument();
		expect(screen.getByText('3')).toBeInTheDocument();
	});

	it('optimistically toggles to Liked and POSTs the like', async () => {
		render(LikeButton);
		const btn = await screen.findByRole('button', { name: 'Like' });
		await waitFor(() => expect(btn).toBeEnabled());

		await fireEvent.click(btn);

		expect(fetch).toHaveBeenCalledWith(
			'/api/likes',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify({ url: '/blog/test', liked: true })
			})
		);
		await waitFor(() => expect(screen.getByRole('button', { name: 'Liked' })).toBeInTheDocument());
		// Count optimistically reflects our own +1.
		expect(screen.getByText('4')).toBeInTheDocument();
	});

	it('is disabled when the visitor has no ipHash', async () => {
		setPage({ data: { ipHash: '' } });
		render(LikeButton);
		const btn = await screen.findByRole('button', { name: 'Like' });
		await waitFor(() => expect(btn).toBeDisabled());
	});

	it('reverts and surfaces an error when the request fails', async () => {
		fetch.mockResolvedValue({ ok: false, json: async () => ({ message: 'You have been banned' }) });
		render(LikeButton);
		const btn = await screen.findByRole('button', { name: 'Like' });
		await waitFor(() => expect(btn).toBeEnabled());

		await fireEvent.click(btn);

		expect(await screen.findByText('You have been banned')).toBeInTheDocument();
		// Reverted back to the un-liked server state.
		await waitFor(() => expect(screen.getByRole('button', { name: 'Like' })).toBeInTheDocument());
	});
});
