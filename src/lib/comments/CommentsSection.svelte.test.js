import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';

// useQuery needs a live Convex context; stub it with controllable state.
vi.mock('convex-svelte', () => ({ useQuery: vi.fn() }));

import { useQuery } from 'convex-svelte';
import { setPage, page } from '$app/stores';
import { get } from 'svelte/store';
import { tick } from 'svelte';
import { createReactiveQuery } from '../../test/mocks/reactive-query.svelte.js';
import CommentsSection from './CommentsSection.svelte';

function comment(overrides = {}) {
	return {
		id: 'c1',
		url: '/blog/test',
		username: 'alice',
		text: 'hello world',
		reply: null,
		parentId: null,
		depth: 0,
		score: 2,
		upvotes: 2,
		downvotes: 0,
		myVote: null,
		createdAt: 1000,
		updatedAt: null,
		...overrides
	};
}

function mockQuery(overrides = {}) {
	useQuery.mockReturnValue({
		data: [],
		isLoading: false,
		isStale: false,
		error: null,
		...overrides
	});
}

beforeEach(() => {
	setPage();
	mockQuery();
	vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
});

describe('CommentsSection form', () => {
	it('renders the heading and form fields', () => {
		render(CommentsSection);
		expect(screen.getByRole('heading', { name: 'Comments' })).toBeInTheDocument();
		expect(screen.getByPlaceholderText(/Name \(optional/)).toBeInTheDocument();
		expect(screen.getByPlaceholderText(/Say something/)).toBeInTheDocument();
		expect(screen.getByPlaceholderText(/Password \(save this/)).toBeInTheDocument();
	});

	it('keeps Submit disabled until text and a valid password are present', async () => {
		render(CommentsSection);
		const submit = screen.getByRole('button', { name: 'Submit' });
		expect(submit).toBeDisabled();

		await fireEvent.input(screen.getByPlaceholderText(/Say something/), {
			target: { value: 'nice post' }
		});
		expect(submit).toBeDisabled(); // still missing password

		await fireEvent.input(screen.getByPlaceholderText(/Password \(save this/), {
			target: { value: 'pw12' }
		});
		await waitFor(() => expect(submit).toBeEnabled());
	});

	it('POSTs the comment and clears the form on success', async () => {
		render(CommentsSection);
		await fireEvent.input(screen.getByPlaceholderText(/Name \(optional/), {
			target: { value: 'bob' }
		});
		const textarea = screen.getByPlaceholderText(/Say something/);
		await fireEvent.input(textarea, { target: { value: 'great read' } });
		await fireEvent.input(screen.getByPlaceholderText(/Password \(save this/), {
			target: { value: 'pw12' }
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

		expect(fetch).toHaveBeenCalledWith(
			'/api/comments',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify({
					url: '/blog/test',
					username: 'bob',
					password: 'pw12',
					text: 'great read'
				})
			})
		);
		await waitFor(() => expect(textarea.value).toBe(''));
	});
});

describe('CommentsSection list states', () => {
	it('shows the empty state when there are no comments', () => {
		render(CommentsSection);
		expect(screen.getByText('No comments yet. Be the first to comment!')).toBeInTheDocument();
	});

	it('shows an error state when the query errors', () => {
		mockQuery({ error: new Error('boom') });
		render(CommentsSection);
		expect(screen.getByText('Could not load comments.')).toBeInTheDocument();
	});

	it('does not show the empty state while loading', () => {
		mockQuery({ isLoading: true });
		render(CommentsSection);
		expect(screen.queryByText(/No comments yet/)).toBeNull();
	});

	it('renders a comment from the query', () => {
		mockQuery({ data: [comment({ username: 'carol', text: 'first!' })] });
		render(CommentsSection);
		expect(screen.getByText('carol')).toBeInTheDocument();
		expect(screen.getByText('first!')).toBeInTheDocument();
	});
});

describe('CommentsSection voting', () => {
	it('POSTs a vote when a comment vote button is clicked', async () => {
		mockQuery({ data: [comment({ id: 'abc' })] });
		render(CommentsSection);

		await fireEvent.click(screen.getByRole('button', { name: 'Upvote' }));

		await waitFor(() =>
			expect(fetch).toHaveBeenCalledWith(
				'/api/comments/abc/vote',
				expect.objectContaining({ method: 'POST', body: JSON.stringify({ voteType: 'up' }) })
			)
		);
	});
});

describe('CommentsSection SPA navigation', () => {
	it('does not render stale comments from the previous page while the new list loads', async () => {
		const query = createReactiveQuery({
			data: [comment({ username: 'page-a', text: 'from page A' })],
			isStale: false,
			isLoading: false
		});
		useQuery.mockReturnValue(query);

		render(CommentsSection);
		expect(screen.getByText('page-a')).toBeInTheDocument();

		page.set({
			...get(page),
			url: new URL('http://localhost/blog/other')
		});
		query.set({ isStale: true });
		await tick();

		expect(screen.queryByText('page-a')).toBeNull();
		expect(screen.queryByText('No comments yet')).toBeNull();
	});

	it('shows the new page comments once the subscription is fresh', async () => {
		const query = createReactiveQuery({
			data: [comment({ username: 'page-a', text: 'from page A' })],
			isStale: false,
			isLoading: false
		});
		useQuery.mockReturnValue(query);

		render(CommentsSection);

		page.set({
			...get(page),
			url: new URL('http://localhost/blog/other')
		});
		query.set({ isStale: true });
		await tick();

		query.set({
			data: [comment({ username: 'page-b', text: 'from page B' })],
			isStale: false
		});
		await tick();

		expect(screen.queryByText('page-a')).toBeNull();
		expect(screen.getByText('page-b')).toBeInTheDocument();
	});
});
