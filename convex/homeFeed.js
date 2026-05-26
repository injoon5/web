import { internalAction, internalMutation, internalQuery, query } from './_generated/server';
import { v } from 'convex/values';
import { internal } from './_generated/api.js';

const DATA_REPO_RAW = 'https://raw.githubusercontent.com/injoon5/data/main';
const NOW_PLAYING_URL = `${DATA_REPO_RAW}/now-playing.json`;
const PHOTOS_URL = `${DATA_REPO_RAW}/photos.json`;

const KEYS = {
	nowPlaying: 'nowPlaying',
	photos: 'photos'
};

function parsePayload(row) {
	if (!row) return null;
	return {
		data: JSON.parse(row.payload),
		updatedAt: row.updatedAt,
		lastSyncError: row.lastSyncError
	};
}

export const getNowPlaying = query({
	args: {},
	handler: async (ctx) => {
		const row = await ctx.db
			.query('homeFeedCache')
			.withIndex('by_key', (q) => q.eq('key', KEYS.nowPlaying))
			.unique();
		return parsePayload(row);
	}
});

export const getPhotos = query({
	args: {},
	handler: async (ctx) => {
		const row = await ctx.db
			.query('homeFeedCache')
			.withIndex('by_key', (q) => q.eq('key', KEYS.photos))
			.unique();
		return parsePayload(row);
	}
});

export const getCacheRow = internalQuery({
	args: { key: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query('homeFeedCache')
			.withIndex('by_key', (q) => q.eq('key', args.key))
			.unique();
	}
});

export const upsertCache = internalMutation({
	args: {
		key: v.string(),
		payload: v.string(),
		lastSyncError: v.union(v.string(), v.null())
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query('homeFeedCache')
			.withIndex('by_key', (q) => q.eq('key', args.key))
			.unique();

		const fields = {
			payload: args.payload,
			updatedAt: Date.now(),
			lastSyncError: args.lastSyncError
		};

		if (existing) {
			await ctx.db.patch(existing._id, fields);
		} else {
			await ctx.db.insert('homeFeedCache', { key: args.key, ...fields });
		}
	}
});

async function fetchJsonPayload(url) {
	const res = await fetch(url, {
		headers: { Accept: 'application/json' }
	});
	if (!res.ok) {
		throw new Error(`${url} HTTP ${res.status}`);
	}
	const json = await res.json();
	return JSON.stringify(json);
}

async function syncKey(ctx, key, url) {
	try {
		const payload = await fetchJsonPayload(url);
		await ctx.runMutation(internal.homeFeed.upsertCache, {
			key,
			payload,
			lastSyncError: null
		});
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Sync failed';
		const existing = await ctx.runQuery(internal.homeFeed.getCacheRow, { key });
		if (existing) {
			await ctx.runMutation(internal.homeFeed.upsertCache, {
				key,
				payload: existing.payload,
				lastSyncError: message
			});
		} else {
			console.error(`homeFeed sync ${key}:`, message);
		}
	}
}

export const syncNowPlaying = internalAction({
	args: {},
	handler: async (ctx) => {
		await syncKey(ctx, KEYS.nowPlaying, NOW_PLAYING_URL);
	}
});

export const syncPhotos = internalAction({
	args: {},
	handler: async (ctx) => {
		await syncKey(ctx, KEYS.photos, PHOTOS_URL);
	}
});
