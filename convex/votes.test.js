/**
 * Vote counting.
 *
 * The denormalized `upvotes`/`downvotes` on a comment are stepped by a delta
 * rather than recounted from the votes table, so the arithmetic is now this
 * code's job rather than a side effect of re-reading. These assert that every
 * path through the toggle lands on the count a full recount would have
 * produced — including the stray-row dedupe, which has to back out rows nobody
 * asked about.
 */

import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import rateLimiter from '@convex-dev/rate-limiter/test';
import { api } from './_generated/api.js';
import schema from './schema.js';

const modules = import.meta.glob('./**/*.js');

function setup() {
	const t = convexTest(schema, modules);
	t.registerComponent('rateLimiter', rateLimiter.schema, rateLimiter.modules);
	return t;
}

const URL = '/blog/test';

async function seedComment(t, overrides = {}) {
	return await t.run(async (ctx) =>
		ctx.db.insert('comments', {
			url: URL,
			username: 'someone',
			passwordHash: '$2a$10$notarealhash',
			text: 'hello',
			ipHash: 'author',
			parentId: null,
			depth: 0,
			reply: null,
			updatedAt: null,
			deletedAt: null,
			upvotes: 0,
			downvotes: 0,
			...overrides
		})
	);
}

/** The counts actually stored on the doc, which is what `list` serves. */
async function storedCounts(t, commentId) {
	return await t.run(async (ctx) => {
		const doc = await ctx.db.get('comments', commentId);
		return { upvotes: doc.upvotes, downvotes: doc.downvotes };
	});
}

/** A recount straight from the votes table — the value the deltas must match. */
async function trueCounts(t, commentId) {
	return await t.run(async (ctx) => {
		const rows = await ctx.db
			.query('commentVotes')
			.withIndex('by_comment_ip', (q) => q.eq('commentId', commentId))
			.collect();
		return {
			upvotes: rows.filter((r) => r.voteType === 'up').length,
			downvotes: rows.filter((r) => r.voteType === 'down').length
		};
	});
}

describe('vote', () => {
	it('counts a first vote', async () => {
		const t = setup();
		const id = await seedComment(t);

		const result = await t.mutation(api.comments.vote, {
			commentId: id,
			voteType: 'up',
			ipHash: 'visitor'
		});

		expect(result).toMatchObject({ upvotes: 1, downvotes: 0, myVote: 'up' });
		expect(await storedCounts(t, id)).toEqual({ upvotes: 1, downvotes: 0 });
	});

	it('backs the vote out when the same side is clicked again', async () => {
		const t = setup();
		const id = await seedComment(t);
		const args = { commentId: id, voteType: 'up', ipHash: 'visitor' };

		await t.mutation(api.comments.vote, args);
		const result = await t.mutation(api.comments.vote, args);

		expect(result).toMatchObject({ upvotes: 0, downvotes: 0, myVote: null });
		expect(await storedCounts(t, id)).toEqual(await trueCounts(t, id));
	});

	it('moves the count across when the vote switches sides', async () => {
		const t = setup();
		const id = await seedComment(t);

		await t.mutation(api.comments.vote, { commentId: id, voteType: 'up', ipHash: 'visitor' });
		const result = await t.mutation(api.comments.vote, {
			commentId: id,
			voteType: 'down',
			ipHash: 'visitor'
		});

		expect(result).toMatchObject({ upvotes: 0, downvotes: 1, myVote: 'down' });
		expect(await storedCounts(t, id)).toEqual(await trueCounts(t, id));
	});

	it('keeps separate visitors separate', async () => {
		const t = setup();
		const id = await seedComment(t);

		await t.mutation(api.comments.vote, { commentId: id, voteType: 'up', ipHash: 'a' });
		await t.mutation(api.comments.vote, { commentId: id, voteType: 'up', ipHash: 'b' });
		const result = await t.mutation(api.comments.vote, {
			commentId: id,
			voteType: 'down',
			ipHash: 'c'
		});

		expect(result).toMatchObject({ upvotes: 2, downvotes: 1 });
		expect(await storedCounts(t, id)).toEqual(await trueCounts(t, id));
	});

	it('backs stray duplicate rows out of the counts', async () => {
		const t = setup();
		const id = await seedComment(t);

		// Two rows for one visitor, as a past race could leave, with the stored
		// counts reflecting both. A recount used to absorb this silently; a delta
		// has to subtract the row it deletes.
		await t.run(async (ctx) => {
			await ctx.db.insert('commentVotes', { commentId: id, ipHash: 'visitor', voteType: 'up' });
			await ctx.db.insert('commentVotes', { commentId: id, ipHash: 'visitor', voteType: 'down' });
			await ctx.db.patch('comments', id, { upvotes: 1, downvotes: 1 });
		});

		const result = await t.mutation(api.comments.vote, {
			commentId: id,
			voteType: 'up',
			ipHash: 'visitor'
		});

		// One row survives the dedupe, and it was an 'up' being toggled off.
		expect(await storedCounts(t, id)).toEqual(await trueCounts(t, id));
		expect(result.upvotes).toBe(0);
		expect(result.downvotes).toBe(0);
		expect(result.myVote).toBeNull();
	});

	it('counts a legacy row that predates the denormalized fields', async () => {
		const t = setup();
		// `upvotes`/`downvotes` are optional in the schema precisely for these.
		const id = await t.run(async (ctx) =>
			ctx.db.insert('comments', {
				url: URL,
				username: 'someone',
				passwordHash: '$2a$10$notarealhash',
				text: 'hello',
				ipHash: 'author',
				parentId: null,
				depth: 0,
				reply: null,
				updatedAt: null,
				deletedAt: null
			})
		);
		await t.run(async (ctx) => {
			await ctx.db.insert('commentVotes', { commentId: id, ipHash: 'old', voteType: 'up' });
		});

		const result = await t.mutation(api.comments.vote, {
			commentId: id,
			voteType: 'up',
			ipHash: 'visitor'
		});

		// Falls back to a full count, which also fills the fields in for good.
		expect(result).toMatchObject({ upvotes: 2, downvotes: 0, myVote: 'up' });
		expect(await storedCounts(t, id)).toEqual({ upvotes: 2, downvotes: 0 });
	});

	it('never lets a drifted count settle below zero', async () => {
		const t = setup();
		const id = await seedComment(t);
		await t.run(async (ctx) => {
			await ctx.db.insert('commentVotes', { commentId: id, ipHash: 'visitor', voteType: 'up' });
			// Stored counts that lost track of the row above.
			await ctx.db.patch('comments', id, { upvotes: 0, downvotes: 0 });
		});

		const result = await t.mutation(api.comments.vote, {
			commentId: id,
			voteType: 'up',
			ipHash: 'visitor'
		});

		expect(result.upvotes).toBe(0);
		expect(result.myVote).toBeNull();
	});
});
