import {
	pgTable,
	uuid,
	text,
	timestamp,
	pgEnum,
	uniqueIndex
} from 'drizzle-orm/pg-core';

export const voteTypeEnum = pgEnum('vote_type', ['up', 'down']);

export const comments = pgTable('comments', {
	id: uuid('id').primaryKey().defaultRandom(),
	url: text('url').notNull(),
	username: text('username').notNull().default('Anonymous'),
	passwordHash: text('password_hash').notNull(),
	text: text('text').notNull(),
	ipHash: text('ip_hash').notNull(),
	reply: text('reply'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	deletedAt: timestamp('deleted_at', { withTimezone: true })
});

export const commentVotes = pgTable(
	'comment_votes',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		commentId: uuid('comment_id')
			.notNull()
			.references(() => comments.id, { onDelete: 'cascade' }),
		ipHash: text('ip_hash').notNull(),
		voteType: voteTypeEnum('vote_type').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [uniqueIndex('comment_votes_unique').on(t.commentId, t.ipHash)]
);

export const likes = pgTable(
	'likes',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		url: text('url').notNull(),
		ipHash: text('ip_hash').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [uniqueIndex('likes_unique').on(t.url, t.ipHash)]
);

export const bannedIps = pgTable('banned_ips', {
	id: uuid('id').primaryKey().defaultRandom(),
	ipHash: text('ip_hash').notNull().unique(),
	reason: text('reason'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export type Comment = typeof comments.$inferSelect;
export type CommentVote = typeof commentVotes.$inferSelect;
export type Like = typeof likes.$inferSelect;
export type BannedIp = typeof bannedIps.$inferSelect;
