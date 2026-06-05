import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { SvelteSet } from 'svelte/reactivity';
import CommentNode from './CommentNode.svelte';

function baseComment(overrides = {}) {
	return {
		id: 'c1',
		url: '/blog/test',
		username: 'alice',
		text: 'hello world',
		reply: null,
		depth: 0,
		score: 5,
		upvotes: 5,
		downvotes: 0,
		myVote: null,
		createdAt: 1000,
		updatedAt: null,
		children: [],
		...overrides
	};
}

function renderNode(commentOverrides = {}, propOverrides = {}) {
	const onVote = vi.fn();
	const onHaptic = vi.fn();
	const setActiveForm = vi.fn();
	const result = render(CommentNode, {
		props: {
			comment: baseComment(commentOverrides),
			activeFormId: null,
			setActiveForm,
			votingIds: new SvelteSet(),
			votingAnim: { id: null, side: null },
			canVote: true,
			voteKnown: true,
			onVote,
			onHaptic,
			...propOverrides
		}
	});
	return { ...result, onVote, onHaptic, setActiveForm };
}

describe('CommentNode rendering', () => {
	it('renders the username and comment text', () => {
		renderNode();
		expect(screen.getByText('alice')).toBeInTheDocument();
		expect(screen.getByText('hello world')).toBeInTheDocument();
	});

	it('escapes HTML in comment text (no markup injection)', () => {
		const payload = '<img src=x onerror="alert(1)">';
		const { container } = renderNode({ text: payload });
		// Rendered as literal text, not parsed into an element.
		expect(screen.getByText(payload)).toBeInTheDocument();
		expect(container.querySelector('img')).toBeNull();
	});

	it('shows [deleted] and hides actions for a deleted comment', () => {
		renderNode({ username: '[deleted]', text: '[deleted]' });
		expect(screen.getAllByText('[deleted]').length).toBeGreaterThan(0);
		expect(screen.queryByRole('button', { name: 'Upvote' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Edit comment' })).toBeNull();
	});

	it('renders an admin reply when present', () => {
		renderNode({ reply: 'Thanks for reading' });
		expect(screen.getByText('Admin Reply:')).toBeInTheDocument();
		expect(screen.getByText('Thanks for reading')).toBeInTheDocument();
	});

	it('marks edited comments', () => {
		renderNode({ createdAt: 1000, updatedAt: 2000 });
		expect(screen.getByText('(edited)')).toBeInTheDocument();
	});
});

describe('CommentNode voting', () => {
	it('calls onVote and onHaptic when a vote button is clicked', async () => {
		const { onVote, onHaptic } = renderNode();
		await fireEvent.click(screen.getByRole('button', { name: 'Upvote' }));
		expect(onVote).toHaveBeenCalledWith('c1', 'up');
		expect(onHaptic).toHaveBeenCalled();
	});

	it('reflects the visitor vote via aria-pressed when known', () => {
		renderNode({ myVote: 'up' });
		expect(screen.getByRole('button', { name: 'Upvote' })).toHaveAttribute('aria-pressed', 'true');
		expect(screen.getByRole('button', { name: 'Downvote' })).toHaveAttribute(
			'aria-pressed',
			'false'
		);
	});

	it('shows a neutral vote when the vote is not yet trustworthy', () => {
		renderNode({ myVote: 'up' }, { voteKnown: false });
		expect(screen.getByRole('button', { name: 'Upvote' })).toHaveAttribute('aria-pressed', 'false');
	});

	it('disables voting when canVote is false', () => {
		renderNode({}, { canVote: false });
		expect(screen.getByRole('button', { name: 'Upvote' })).toBeDisabled();
	});

	it('disables voting while a vote for this comment is in flight', () => {
		renderNode({}, { votingIds: new SvelteSet(['c1']) });
		expect(screen.getByRole('button', { name: 'Upvote' })).toBeDisabled();
	});
});

describe('CommentNode replies', () => {
	it('shows a reply button up to depth 1 and hides it at depth 2', () => {
		renderNode({ depth: 1 });
		expect(screen.getByRole('button', { name: 'Reply' })).toBeInTheDocument();

		renderNode({ id: 'deep', depth: 2 });
		// Only the depth-1 node's Reply button should exist.
		expect(screen.getAllByRole('button', { name: 'Reply' })).toHaveLength(1);
	});

	it('notifies the parent when opening a reply form', async () => {
		const { setActiveForm, onHaptic } = renderNode();
		await fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
		expect(setActiveForm).toHaveBeenCalledWith('c1');
		expect(onHaptic).toHaveBeenCalled();
	});

	it('reveals the reply form when this card is the active form', async () => {
		renderNode({}, { activeFormId: 'c1' });
		await fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
		expect(screen.getByPlaceholderText(/Reply…/)).toBeInTheDocument();
	});
});
