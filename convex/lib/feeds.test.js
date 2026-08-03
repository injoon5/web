import { describe, expect, it } from 'vitest';
import { PHOTO_LIMIT, TRACK_LIMIT, lastfmUrl, normalizePhotos, normalizeTracks } from './feeds.js';

const track = (over = {}) => ({
	name: 'for lovers who hesitate',
	url: 'https://www.last.fm/music/JANNABI/_/for+lovers+who+hesitate',
	artist: { mbid: '', '#text': 'JANNABI' },
	album: { mbid: '', '#text': 'LEGEND' },
	image: [
		{ size: 'small', '#text': 'https://lastfm.example/34s.jpg' },
		{ size: 'medium', '#text': 'https://lastfm.example/64s.jpg' },
		{ size: 'large', '#text': 'https://lastfm.example/174s.jpg' },
		{ size: 'extralarge', '#text': 'https://lastfm.example/300x300.jpg' }
	],
	date: { uts: '1785403960', '#text': '30 Jul 2026, 09:32' },
	...over
});

const photo = (over = {}) => ({
	id: 'ylgaV3Iz',
	title: 'City Twilight',
	url: 'https://photos.injoon5.com/p/ylgaV3Iz',
	takenAtNaive: '09 May 2026 7:50PM',
	src: {
		small: { url: 'https://photos.example/w=200' },
		medium: { url: 'https://photos.example/w=640' },
		large: { url: 'https://photos.example/w=1200' }
	},
	...over
});

describe('normalizeTracks', () => {
	it('keeps only what the marquee renders', () => {
		const [first] = normalizeTracks({ recenttracks: { track: [track()] } });

		expect(first).toEqual({
			name: 'for lovers who hesitate',
			artist: 'JANNABI',
			url: 'https://www.last.fm/music/JANNABI/_/for+lovers+who+hesitate',
			image: 'https://lastfm.example/174s.jpg',
			nowPlaying: false,
			playedAt: 1785403960 * 1000
		});
	});

	it('marks the playing track and leaves it without a timestamp', () => {
		const playing = track({ '@attr': { nowplaying: 'true' } });
		delete playing.date;

		const [first, second] = normalizeTracks({ recenttracks: { track: [playing, track()] } });

		expect(first.nowPlaying).toBe(true);
		expect(first.playedAt).toBe(null);
		expect(second.playedAt).toBe(1785403960 * 1000);
	});

	it('falls back to any cover when the large size is missing', () => {
		const noLarge = track({
			image: [{ size: 'small', '#text': 'https://lastfm.example/34s.jpg' }]
		});

		expect(normalizeTracks({ recenttracks: { track: [noLarge] } })[0].image).toBe(
			'https://lastfm.example/34s.jpg'
		);
	});

	it('tolerates a track with no cover at all', () => {
		const bare = track({ image: [{ size: 'large', '#text': '' }], artist: undefined });

		expect(normalizeTracks({ recenttracks: { track: [bare] } })[0]).toMatchObject({
			image: '',
			artist: ''
		});
	});

	it('caps the list', () => {
		const many = Array.from({ length: 50 }, () => track());

		expect(normalizeTracks({ recenttracks: { track: many } })).toHaveLength(TRACK_LIMIT);
	});

	it('throws on a response without recenttracks.track', () => {
		expect(() => normalizeTracks({ error: 10, message: 'Invalid API key' })).toThrow(
			/recenttracks/
		);
	});
});

describe('normalizePhotos', () => {
	it('keeps the medium source and the feed-formatted capture time', () => {
		const [first] = normalizePhotos({ photos: [photo()] });

		expect(first).toEqual({
			id: 'ylgaV3Iz',
			title: 'City Twilight',
			url: 'https://photos.injoon5.com/p/ylgaV3Iz',
			image: 'https://photos.example/w=640',
			takenAt: '09 May 2026 7:50PM'
		});
	});

	it('falls back to the large source', () => {
		const noMedium = photo({ src: { large: { url: 'https://photos.example/w=1200' } } });

		expect(normalizePhotos({ photos: [noMedium] })[0].image).toBe('https://photos.example/w=1200');
	});

	it('caps the list', () => {
		const many = Array.from({ length: 40 }, (_, i) => photo({ id: `p${i}` }));

		expect(normalizePhotos({ photos: many })).toHaveLength(PHOTO_LIMIT);
	});

	it('throws on a feed without a photos array', () => {
		expect(() => normalizePhotos({ meta: {} })).toThrow(/photos array/);
	});
});

describe('lastfmUrl', () => {
	it('asks for the user, the format and the limit', () => {
		const url = new URL(lastfmUrl('secret-key'));

		expect(url.searchParams.get('method')).toBe('user.getrecenttracks');
		expect(url.searchParams.get('user')).toBe('injoon5');
		expect(url.searchParams.get('api_key')).toBe('secret-key');
		expect(url.searchParams.get('format')).toBe('json');
		expect(url.searchParams.get('limit')).toBe(String(TRACK_LIMIT));
	});
});
