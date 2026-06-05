import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';

// convex-svelte's useQuery needs a live Convex client/context; replace it with a
// controllable stub that returns fixed server state.
vi.mock('convex-svelte', () => ({ useQuery: vi.fn() }));

import { useQuery } from 'convex-svelte';
import { setPage } from '$app/stores';
import { createReactiveQuery } from '../test/mocks/reactive-query.svelte.js';
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

describe('LikeButton optimistic count', () => {
	it('settles without double-counting when the server confirms our like', async () => {
		const query = createReactiveQuery({ data: { count: 5, liked: false } });
		useQuery.mockReturnValue(query);

		render(LikeButton);
		const btn = await screen.findByRole('button', { name: 'Like' });
		await waitFor(() => expect(btn).toBeEnabled());
		expect(screen.getByText('5')).toBeInTheDocument();

		// Optimistic like: 5 -> 6.
		await fireEvent.click(btn);
		expect(screen.getByText('6')).toBeInTheDocument();

		// The server applies our like and echoes it back. `count` and `liked` move
		// together (one atomic query result), so our optimistic +1 is absorbed into
		// the server count rather than stacked on top of it: 6, never a flash of 7.
		query.set({ data: { count: 6, liked: true } });
		await tick();
		await waitFor(() => expect(screen.getByRole('button', { name: 'Liked' })).toBeInTheDocument());
		expect(screen.getByText('6')).toBeInTheDocument();
		expect(screen.queryByText('7')).toBeNull();
	});

	it('stacks our optimistic like on a concurrent like during the pending window', async () => {
		const query = createReactiveQuery({ data: { count: 5, liked: false } });
		useQuery.mockReturnValue(query);

		render(LikeButton);
		const btn = await screen.findByRole('button', { name: 'Like' });
		await waitFor(() => expect(btn).toBeEnabled());

		// Optimistic like: 5 -> 6.
		await fireEvent.click(btn);
		expect(screen.getByText('6')).toBeInTheDocument();

		// Someone else likes before our write lands: the global count rises but our
		// per-IP `liked` is still false. Our +1 rides on top of the live count -> 7.
		query.set({ data: { count: 6, liked: false } });
		await tick();
		expect(screen.getByText('7')).toBeInTheDocument();

		// Our like lands on top of theirs: server settles at 7, still no double count.
		query.set({ data: { count: 7, liked: true } });
		await tick();
		await waitFor(() => expect(screen.getByText('7')).toBeInTheDocument());
		expect(screen.getByRole('button', { name: 'Liked' })).toBeInTheDocument();
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

describe('LikeButton under rapid clicking', () => {
	it('an odd burst settles Liked and collapses to a single request', async () => {
		const query = createReactiveQuery({ data: { count: 5, liked: false } });
		useQuery.mockReturnValue(query);

		render(LikeButton);
		const btn = await screen.findByRole('button', { name: 'Like' });
		await waitFor(() => expect(btn).toBeEnabled());

		// Five synchronous toggles from unliked -> ends liked. They all land while
		// the first request is still in flight.
		for (let i = 0; i < 5; i++) fireEvent.click(btn);
		await tick();

		// The button reflects the *last* click, never an intermediate one.
		await waitFor(() => expect(screen.getByRole('button', { name: 'Liked' })).toBeInTheDocument());
		expect(screen.getByText('6')).toBeInTheDocument();

		// The whole burst collapsed to one POST for the final state.
		await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
		expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ liked: true });

		// Server confirms: no drift, no double count.
		query.set({ data: { count: 6, liked: true } });
		await tick();
		expect(screen.getByRole('button', { name: 'Liked' })).toBeInTheDocument();
		expect(screen.getByText('6')).toBeInTheDocument();
	});

	it('an even burst settles back to Like with a trailing correction', async () => {
		const query = createReactiveQuery({ data: { count: 5, liked: false } });
		useQuery.mockReturnValue(query);

		render(LikeButton);
		const btn = await screen.findByRole('button', { name: 'Like' });
		await waitFor(() => expect(btn).toBeEnabled());

		// Four synchronous toggles from unliked -> ends unliked.
		for (let i = 0; i < 4; i++) fireEvent.click(btn);

		await waitFor(() => expect(screen.getByRole('button', { name: 'Like' })).toBeInTheDocument());
		expect(screen.getByText('5')).toBeInTheDocument();

		// First request was the optimistic like; a single trailing request corrects
		// the server to the final unliked state — at most two requests for the burst.
		await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
		expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ liked: true });
		expect(JSON.parse(fetch.mock.calls.at(-1)[1].body)).toMatchObject({ liked: false });

		// Server settles unliked: button and count stay consistent.
		query.set({ data: { count: 5, liked: false } });
		await tick();
		expect(screen.getByRole('button', { name: 'Like' })).toBeInTheDocument();
		expect(screen.getByText('5')).toBeInTheDocument();
	});
});
