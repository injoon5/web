import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';

// usePaginatedQuery needs a live Convex context; stub it with controllable state.
vi.mock('convex-svelte', () => ({ usePaginatedQuery: vi.fn() }));

import { usePaginatedQuery } from 'convex-svelte';
import { setPage } from '$app/state';
import { visitor } from '#lib/visitor.svelte.js';
import { createReactivePaginatedQuery } from '../../test/mocks/reactive-query.svelte.js';
import { COMMENTS_PAGE_SIZE } from './constants.js';
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
	usePaginatedQuery.mockReturnValue({
		results: [],
		status: 'Exhausted',
		isLoading: false,
		error: null,
		loadMore: () => false,
		...overrides
	});
}

beforeEach(() => {
	setPage();
	visitor.ipHash = 'test-ip-hash';
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
		mockQuery({ results: [comment({ username: 'carol', text: 'first!' })] });
		render(CommentsSection);
		expect(screen.getByText('carol')).toBeInTheDocument();
		expect(screen.getByText('first!')).toBeInTheDocument();
	});
});

describe('CommentsSection pagination', () => {
	it('loads the next page of threads on request', async () => {
		const loadMore = vi.fn(() => true);
		usePaginatedQuery.mockReturnValue({
			results: [comment({ text: 'first page' })],
			status: 'CanLoadMore',
			isLoading: false,
			error: null,
			loadMore
		});
		render(CommentsSection);
		expect(await screen.findByText('first page')).toBeInTheDocument();

		const button = screen.getByRole('button', { name: 'Load more comments' });
		await fireEvent.click(button);

		expect(loadMore).toHaveBeenCalledWith(COMMENTS_PAGE_SIZE);
	});

	it('hides the load-more button when the list is exhausted', async () => {
		mockQuery({ results: [comment()] });
		render(CommentsSection);
		expect(await screen.findByText('hello world')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Load more comments' })).toBeNull();
	});
});

describe('CommentsSection SPA navigation', () => {
	// Regression: with `keepPreviousData`, the previous page's comments stayed on
	// screen while the new page's list loaded, so a visitor could vote on (or
	// edit/delete) a comment that belongs to the page they just left.
	it('hides the previous page comments once the new page starts loading', async () => {
		const query = createReactivePaginatedQuery({
			results: [comment({ text: 'post-a comment' })],
			status: 'CanLoadMore',
			isLoading: false
		});
		usePaginatedQuery.mockReturnValue(query);
		render(CommentsSection);
		expect(await screen.findByText('post-a comment')).toBeInTheDocument();

		// Navigate: the args change, so convex-svelte retains the previous page's
		// results (same array) while marking the load in flight.
		setPage({ url: new URL('http://localhost/blog/post-b') });
		query.set({ isLoading: true });

		await waitFor(() => expect(screen.queryByText('post-a comment')).toBeNull());
		expect(screen.queryByRole('button', { name: 'Upvote' })).toBeNull();
	});

	it('renders the new page comments once its own result arrives', async () => {
		const query = createReactivePaginatedQuery({
			results: [comment({ text: 'post-a comment' })],
			status: 'CanLoadMore',
			isLoading: false
		});
		usePaginatedQuery.mockReturnValue(query);
		render(CommentsSection);
		expect(await screen.findByText('post-a comment')).toBeInTheDocument();

		setPage({ url: new URL('http://localhost/blog/post-b') });
		query.set({ isLoading: true });
		await waitFor(() => expect(screen.queryByText('post-a comment')).toBeNull());

		query.set({ results: [comment({ id: 'c2', text: 'post-b comment' })], isLoading: false });

		expect(await screen.findByText('post-b comment')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Upvote' })).toBeEnabled();
	});

	it('does not send a vote for a comment from the page just left', async () => {
		const query = createReactivePaginatedQuery({
			results: [comment({ id: 'abc' })],
			status: 'CanLoadMore',
			isLoading: false
		});
		usePaginatedQuery.mockReturnValue(query);
		render(CommentsSection);
		const upvote = await screen.findByRole('button', { name: 'Upvote' });
		fetch.mockClear();

		setPage({ url: new URL('http://localhost/blog/post-b') });
		query.set({ isLoading: true });
		await waitFor(() => expect(screen.queryByText('hello world')).toBeNull());

		// The node is detached, but a click that raced the navigation must be a
		// no-op rather than a vote against post-a.
		await fireEvent.click(upvote);

		expect(fetch).not.toHaveBeenCalled();
	});
});

describe('CommentsSection voting', () => {
	it('POSTs a vote when a comment vote button is clicked', async () => {
		mockQuery({ results: [comment({ id: 'abc' })] });
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

describe('CommentsSection and the visitor identity', () => {
	/**
	 * Answers the way Convex would: nothing for a skipped subscription, and each
	 * comment carrying the vote of whoever the list was read for.
	 */
	function fakeConvex(myVoteFor) {
		const cache = new Map();
		usePaginatedQuery.mockImplementation((_query, args) => {
			const read = () => {
				const a = args();
				if (a === 'skip') return undefined;
				const key = `${a.url}|${a.ipHash}`;
				if (!cache.has(key)) cache.set(key, [comment({ url: a.url, myVote: myVoteFor(a) })]);
				return cache.get(key);
			};
			return {
				get results() {
					return read();
				},
				get isLoading() {
					return !read();
				},
				get status() {
					return read() ? 'Exhausted' : 'LoadingFirstPage';
				},
				error: null,
				loadMore: () => false
			};
		});
	}

	it("reads the list only once the visitor's ipHash is known, and under it", async () => {
		fakeConvex((a) => (a.url === '/blog/test' && a.ipHash === 'test-ip-hash' ? 'up' : null));
		visitor.ipHash = '';
		render(CommentsSection);
		expect(screen.queryByText('hello world')).toBeNull();

		visitor.ipHash = 'test-ip-hash';

		const upvote = await screen.findByRole('button', { name: 'Upvote' });
		expect(upvote).toHaveAttribute('aria-pressed', 'true');
	});
});
