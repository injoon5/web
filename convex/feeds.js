/**
 * The two home-page feeds — Last.fm recent tracks and the photos site — pulled
 * on a Convex cron instead of a GitHub Action committing JSON to a data repo.
 *
 * The refreshes are actions (they do network I/O) that hand a normalized list to
 * a one-row upsert, so a reader never sees a half-written feed. Each feed gets
 * its own action: Last.fm being down shouldn't hold back photos.
 *
 * The queries are public, and can be: both feeds are already public — Last.fm
 * publishes the scrobbles, photos.injoon5.com publishes the photos — and the
 * home page renders exactly what these return.
 */

import { v } from 'convex/values';
import { internalAction, internalMutation, query } from './_generated/server.js';
import { internal } from './_generated/api.js';
import { PHOTOS_FEED_URL, lastfmUrl, normalizePhotos, normalizeTracks } from './lib/feeds.js';

const trackValidator = v.object({
	name: v.string(),
	artist: v.string(),
	url: v.string(),
	image: v.string(),
	nowPlaying: v.boolean(),
	playedAt: v.union(v.number(), v.null())
});

const photoValidator = v.object({
	id: v.string(),
	title: v.string(),
	url: v.string(),
	image: v.string(),
	takenAt: v.string()
});

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export const nowPlaying = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query('nowPlaying').first();
	}
});

export const photos = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query('photos').first();
	}
});

// ---------------------------------------------------------------------------
// Writes
//
// One row per feed, patched in place — a feed has no history worth keeping, and
// an insert-per-refresh would add 288 rows a day per feed.
// ---------------------------------------------------------------------------

export const saveNowPlaying = internalMutation({
	args: { tracks: v.array(trackValidator) },
	handler: async (ctx, args) => {
		const existing = await ctx.db.query('nowPlaying').first();
		const doc = { tracks: args.tracks, updatedAt: Date.now() };
		if (existing) {
			await ctx.db.patch('nowPlaying', existing._id, doc);
		} else {
			await ctx.db.insert('nowPlaying', doc);
		}
	}
});

export const savePhotos = internalMutation({
	args: { photos: v.array(photoValidator) },
	handler: async (ctx, args) => {
		const existing = await ctx.db.query('photos').first();
		const doc = { photos: args.photos, updatedAt: Date.now() };
		if (existing) {
			await ctx.db.patch('photos', existing._id, doc);
		} else {
			await ctx.db.insert('photos', doc);
		}
	}
});

// ---------------------------------------------------------------------------
// Refreshes (cron entry points)
// ---------------------------------------------------------------------------

/**
 * Upstream failures throw rather than write: the cron logs it, the stored row
 * stays as it was, and the page keeps rendering the last good feed instead of
 * emptying out for five minutes. An empty list is treated the same way — both
 * feeds are append-only in practice, so "no items" means the response was bad.
 *
 * @param {Response} response
 * @param {string} label
 */
async function readJson(response, label) {
	if (!response.ok) {
		throw new Error(`${label} HTTP ${response.status}`);
	}
	return await response.json();
}

export const refreshNowPlaying = internalAction({
	args: {},
	handler: async (ctx) => {
		const apiKey = process.env.LAST_FM_PUBLIC_API_KEY;
		if (!apiKey) {
			throw new Error('LAST_FM_PUBLIC_API_KEY is not set');
		}

		const response = await fetch(lastfmUrl(apiKey), { headers: { Accept: 'application/json' } });
		const tracks = normalizeTracks(await readJson(response, 'Last.fm'));
		if (tracks.length === 0) {
			throw new Error('Last.fm returned no tracks');
		}

		await ctx.runMutation(internal.feeds.saveNowPlaying, { tracks });
		return { count: tracks.length };
	}
});

export const refreshPhotos = internalAction({
	args: {},
	handler: async (ctx) => {
		const response = await fetch(PHOTOS_FEED_URL, { headers: { Accept: 'application/json' } });
		const list = normalizePhotos(await readJson(response, 'Photos feed'));
		if (list.length === 0) {
			throw new Error('Photos feed returned no photos');
		}

		await ctx.runMutation(internal.feeds.savePhotos, { photos: list });
		return { count: list.length };
	}
});
