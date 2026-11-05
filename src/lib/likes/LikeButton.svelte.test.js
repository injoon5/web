import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';

// convex-svelte's useQuery needs a live Convex client/context; replace it with a
// controllable stub that returns fixed server state.
vi.mock('convex-svelte', () => ({ useQuery: vi.fn() }));

import { useQuery } from 'convex-svelte';
import { setPage } from '$app/state';
import { visitor } from '#lib/visitor.svelte.js';
import { createReactiveQuery } from '../../test/mocks/reactive-query.svelte.js';
import LikeButton from './LikeButton.svelte';

beforeEach(() => {
	setPage();
	visitor.ipHash = 'test-ip-hash';
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
		visitor.ipHash = '';
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

describe('LikeButton optimistic count (realtime echo)', () => {
	it('never double-counts when the server echoes the like back', async () => {
		const query = createReactiveQuery({ data: { count: 5, liked: false } });
		useQuery.mockReturnValue(query);

		render(LikeButton);
		const btn = await screen.findByRole('button', { name: 'Like' });
		await waitFor(() => expect(btn).toBeEnabled());
		expect(screen.getByText('5')).toBeInTheDocument();

		// Optimistic like: 5 -> 6.
		await fireEvent.click(btn);
		expect(screen.getByText('6')).toBeInTheDocument();

		// Realtime echo where `count` has absorbed our like but `liked` hasn't
		// caught up yet (the window that used to render a transient 7).
		query.set({ data: { count: 6, liked: false } });
		await tick();
		expect(screen.queryByText('7')).toBeNull();
		expect(screen.getByText('6')).toBeInTheDocument();

		// `liked` catches up -> settles, still 6.
		query.set({ data: { count: 6, liked: true } });
		await tick();
		await waitFor(() => expect(screen.getByText('6')).toBeInTheDocument());
		expect(screen.queryByText('7')).toBeNull();
	});

	it('reflects a concurrent like once the optimistic intent settles', async () => {
		const query = createReactiveQuery({ data: { count: 5, liked: false } });
		useQuery.mockReturnValue(query);

		render(LikeButton);
		const btn = await screen.findByRole('button', { name: 'Like' });
		await waitFor(() => expect(btn).toBeEnabled());

		await fireEvent.click(btn);
		expect(screen.getByText('6')).toBeInTheDocument();

		// Our like lands and someone else also liked: server settles at 7.
		query.set({ data: { count: 7, liked: true } });
		await tick();
		await waitFor(() => expect(screen.getByText('7')).toBeInTheDocument());
	});
});

describe('LikeButton and the visitor identity', () => {
	it('keeps the count up while the subscription swaps to the arriving ipHash', async () => {
		visitor.ipHash = '';
		const query = createReactiveQuery({ data: { count: 5, liked: false } });
		useQuery.mockReturnValue(query);

		render(LikeButton);
		expect(await screen.findByText('5')).toBeInTheDocument();

		// The hash lands after the post rendered: the subscription re-keys and its
		// retained result goes stale until the new one arrives.
		visitor.ipHash = 'test-ip-hash';
		query.set({ isStale: true });
		await tick();
		expect(screen.getByText('5')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Like' })).toBeDisabled();

		query.set({ isStale: false, data: { count: 5, liked: true } });
		await waitFor(() => expect(screen.getByRole('button', { name: 'Liked' })).toBeEnabled());
	});

	it('adopts the ipHash its like was written under', async () => {
		fetch.mockResolvedValue({
			ok: true,
			json: async () => ({ count: 4, liked: true, ipHash: 'new-network-hash' })
		});
		render(LikeButton);
		const btn = await screen.findByRole('button', { name: 'Like' });
		await waitFor(() => expect(btn).toBeEnabled());

		await fireEvent.click(btn);
		await waitFor(() => expect(visitor.ipHash).toBe('new-network-hash'));
	});
});
