import { internalAction, internalMutation, internalQuery, query } from './_generated/server';
import { v } from 'convex/values';
import { internal } from './_generated/api.js';

const LAST_FM_USER = 'injoon5';
const LAST_FM_API = 'https://ws.audioscrobbler.com/2.0/';
const PHOTOS_FEED_URL = 'https://photos.injoon5.com/feed.json';
const NOW_PLAYING_TRACK_LIMIT = 20;
const PHOTOS_LIMIT = 8;

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

/** Mirrors injoon5/data now-playing.py — Last.fm recent tracks, capped at 20. */
async function fetchNowPlayingPayload() {
	const apiKey = process.env.LAST_FM_PUBLIC_API_KEY;
	if (!apiKey) {
		throw new Error('LAST_FM_PUBLIC_API_KEY is not set in Convex environment');
	}

	const url = new URL(LAST_FM_API);
	url.searchParams.set('method', 'user.getrecenttracks');
	url.searchParams.set('user', LAST_FM_USER);
	url.searchParams.set('api_key', apiKey);
	url.searchParams.set('format', 'json');

	const res = await fetch(url.toString(), {
		headers: { Accept: 'application/json' }
	});
	if (!res.ok) {
		throw new Error(`Last.fm HTTP ${res.status}`);
	}

	const response = await res.json();
	const recenttracks = response?.recenttracks;
	if (!recenttracks?.track) {
		throw new Error('Invalid Last.fm response: missing recenttracks.track');
	}

	let tracks = recenttracks.track;
	if (!Array.isArray(tracks)) {
		tracks = [tracks];
	}
	recenttracks.track = tracks.slice(0, NOW_PLAYING_TRACK_LIMIT);

	return JSON.stringify(response);
}

/** Mirrors injoon5/data photos.py — photos.injoon5.com feed, capped at 8. */
async function fetchPhotosPayload() {
	const res = await fetch(PHOTOS_FEED_URL, {
		headers: { Accept: 'application/json' }
	});
	if (!res.ok) {
		throw new Error(`photos feed HTTP ${res.status}`);
	}

	const data = await res.json();
	if (Array.isArray(data?.photos)) {
		data.photos = data.photos.slice(0, PHOTOS_LIMIT);
	}

	return JSON.stringify(data);
}

async function syncKey(ctx, key, fetchPayload) {
	try {
		const payload = await fetchPayload();
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
		await syncKey(ctx, KEYS.nowPlaying, fetchNowPlayingPayload);
	}
});

export const syncPhotos = internalAction({
	args: {},
	handler: async (ctx) => {
		await syncKey(ctx, KEYS.photos, fetchPhotosPayload);
	}
});
