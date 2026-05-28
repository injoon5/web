import { query, internalAction, internalMutation } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';

// Number of items the home page actually renders, kept in sync with the
// previous GitHub Actions scripts (20 tracks, 8 photos).
const MAX_TRACKS = 20;
const MAX_PHOTOS = 8;

export const getNowPlaying = query({
	args: {},
	handler: async (ctx) => await ctx.db.query('nowPlaying').first()
});

export const getPhotos = query({
	args: {},
	handler: async (ctx) => await ctx.db.query('photos').first()
});

export const setNowPlaying = internalMutation({
	args: { data: v.any() },
	handler: async (ctx, args) => {
		const existing = await ctx.db.query('nowPlaying').first();
		if (existing) {
			await ctx.db.patch(existing._id, { data: args.data, updatedAt: Date.now() });
		} else {
			await ctx.db.insert('nowPlaying', { data: args.data, updatedAt: Date.now() });
		}
	}
});

export const setPhotos = internalMutation({
	args: { data: v.any() },
	handler: async (ctx, args) => {
		const existing = await ctx.db.query('photos').first();
		if (existing) {
			await ctx.db.patch(existing._id, { data: args.data, updatedAt: Date.now() });
		} else {
			await ctx.db.insert('photos', { data: args.data, updatedAt: Date.now() });
		}
	}
});

export const refreshNowPlaying = internalAction({
	args: {},
	handler: async (ctx) => {
		const apiKey = process.env.LAST_FM_PUBLIC_API_KEY;
		if (!apiKey) throw new Error('LAST_FM_PUBLIC_API_KEY is not set');

		const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=injoon5&api_key=${apiKey}&format=json`;
		const res = await fetch(url, { headers: { Accept: 'application/json' } });
		if (!res.ok) throw new Error(`Last.fm HTTP ${res.status}`);

		const json = await res.json();
		if (Array.isArray(json?.recenttracks?.track)) {
			json.recenttracks.track = json.recenttracks.track.slice(0, MAX_TRACKS);
		}
		await ctx.runMutation(internal.media.setNowPlaying, { data: json });
	}
});

export const refreshPhotos = internalAction({
	args: {},
	handler: async (ctx) => {
		const res = await fetch('https://photos.injoon5.com/feed.json', {
			headers: { Accept: 'application/json' }
		});
		if (!res.ok) throw new Error(`photos feed HTTP ${res.status}`);

		const json = await res.json();
		if (Array.isArray(json?.photos)) {
			json.photos = json.photos.slice(0, MAX_PHOTOS);
		}
		await ctx.runMutation(internal.media.setPhotos, { data: json });
	}
});
