/**
 * The cron-driven feed refreshes. What matters here isn't the normalizing —
 * `lib/feeds.test.js` covers that — it's that a bad upstream response leaves the
 * stored feed alone, since the page renders whatever the row holds until the
 * next successful refresh.
 */

import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from './_generated/api.js';
import schema from './schema.js';

const modules = import.meta.glob('./**/*.js');

const setup = () => convexTest(schema, modules);

const lastfmResponse = (names) => ({
	recenttracks: {
		track: names.map((name) => ({
			name,
			url: `https://www.last.fm/music/x/_/${name}`,
			artist: { '#text': 'JANNABI' },
			image: [{ size: 'large', '#text': 'https://lastfm.example/174s.jpg' }],
			date: { uts: '1785403960', '#text': '30 Jul 2026, 09:32' }
		}))
	}
});

const photosResponse = (ids) => ({
	photos: ids.map((id) => ({
		id,
		title: id,
		url: `https://photos.injoon5.com/p/${id}`,
		takenAtNaive: '09 May 2026 7:50PM',
		src: { medium: { url: `https://photos.example/${id}` } }
	}))
});

/** Stub the one outbound call each refresh makes. */
const respond = (body, { ok = true, status = 200 } = {}) =>
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => ({ ok, status, json: async () => body }))
	);

beforeEach(() => {
	process.env.LAST_FM_PUBLIC_API_KEY = 'test-lastfm-key';
});

afterEach(() => {
	vi.unstubAllGlobals();
	delete process.env.LAST_FM_PUBLIC_API_KEY;
});

describe('now playing', () => {
	it('stores the normalized tracks and serves them from the public query', async () => {
		const t = setup();
		respond(lastfmResponse(['one', 'two']));

		await t.action(internal.feeds.refreshNowPlaying, {});

		const doc = await t.query(api.feeds.nowPlaying, {});
		expect(doc.tracks.map((track) => track.name)).toEqual(['one', 'two']);
		expect(doc.tracks[0].image).toBe('https://lastfm.example/174s.jpg');
		expect(doc.updatedAt).toBeGreaterThan(0);
	});

	it('overwrites the single row rather than appending', async () => {
		const t = setup();

		respond(lastfmResponse(['one']));
		await t.action(internal.feeds.refreshNowPlaying, {});
		respond(lastfmResponse(['two']));
		await t.action(internal.feeds.refreshNowPlaying, {});

		const rows = await t.run(async (ctx) => ctx.db.query('nowPlaying').take(10));
		expect(rows).toHaveLength(1);
		expect(rows[0].tracks.map((track) => track.name)).toEqual(['two']);
	});

	it('keeps the last good feed when Last.fm errors', async () => {
		const t = setup();

		respond(lastfmResponse(['one']));
		await t.action(internal.feeds.refreshNowPlaying, {});

		respond({ error: 10, message: 'Invalid API key' }, { ok: false, status: 403 });
		await expect(t.action(internal.feeds.refreshNowPlaying, {})).rejects.toThrow(/403/);

		const doc = await t.query(api.feeds.nowPlaying, {});
		expect(doc.tracks.map((track) => track.name)).toEqual(['one']);
	});

	it('refuses to blank the feed on an empty response', async () => {
		const t = setup();

		respond(lastfmResponse(['one']));
		await t.action(internal.feeds.refreshNowPlaying, {});

		respond(lastfmResponse([]));
		await expect(t.action(internal.feeds.refreshNowPlaying, {})).rejects.toThrow(/no tracks/);

		const doc = await t.query(api.feeds.nowPlaying, {});
		expect(doc.tracks).toHaveLength(1);
	});

	it('fails loudly when the API key is missing', async () => {
		const t = setup();
		delete process.env.LAST_FM_PUBLIC_API_KEY;
		respond(lastfmResponse(['one']));

		await expect(t.action(internal.feeds.refreshNowPlaying, {})).rejects.toThrow(
			/LAST_FM_PUBLIC_API_KEY/
		);
	});
});

describe('photos', () => {
	it('stores the normalized photos', async () => {
		const t = setup();
		respond(photosResponse(['a', 'b']));

		await t.action(internal.feeds.refreshPhotos, {});

		const doc = await t.query(api.feeds.photos, {});
		expect(doc.photos.map((photo) => photo.id)).toEqual(['a', 'b']);
		expect(doc.photos[0].image).toBe('https://photos.example/a');
	});

	it('keeps the last good feed when the photo site errors', async () => {
		const t = setup();

		respond(photosResponse(['a']));
		await t.action(internal.feeds.refreshPhotos, {});

		respond({}, { ok: false, status: 500 });
		await expect(t.action(internal.feeds.refreshPhotos, {})).rejects.toThrow(/500/);

		const doc = await t.query(api.feeds.photos, {});
		expect(doc.photos.map((photo) => photo.id)).toEqual(['a']);
	});
});

describe('before the first refresh', () => {
	it('serves null rather than throwing', async () => {
		const t = setup();

		expect(await t.query(api.feeds.nowPlaying, {})).toBe(null);
		expect(await t.query(api.feeds.photos, {})).toBe(null);
	});
});
