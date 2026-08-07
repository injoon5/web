/**
 * Pure helpers for the two home-page feeds (no `ctx`, no `Date.now()`), so the
 * upstream-shape wrangling is testable without a deployment. Both feeds are
 * normalized at write time: the raw payloads are ~20x what the page renders and
 * carry `#text`/`@attr` keys the schema should not hold.
 */

/** Last.fm account the recent-tracks feed is read for. */
const LASTFM_USER = 'injoon5';

/** The marquee loops 20 covers; the grid shows 6 of the 8 kept. */
export const TRACK_LIMIT = 20;
export const PHOTO_LIMIT = 8;

export const PHOTOS_FEED_URL = 'https://photos.injoon5.com/feed.json';

/** @param {string} apiKey */
export function lastfmUrl(apiKey) {
	const params = new URLSearchParams({
		method: 'user.getrecenttracks',
		user: LASTFM_USER,
		api_key: apiKey,
		format: 'json',
		limit: String(TRACK_LIMIT)
	});
	return `https://ws.audioscrobbler.com/2.0/?${params}`;
}

const str = (value) => (typeof value === 'string' ? value : '');

/**
 * Last.fm returns four sizes, small → extralarge. The page renders a 192px
 * cover, so 'large' (174px) fits closest; fall back to any entry with a URL.
 * @param {unknown} images
 */
function coverUrl(images) {
	if (!Array.isArray(images)) return '';
	const large = images.find((image) => image?.size === 'large');
	const withUrl = images.find((image) => str(image?.['#text']));
	return str(large?.['#text']) || str(withUrl?.['#text']);
}

/**
 * `date` is absent on the currently-playing track (Last.fm marks it with
 * `@attr.nowplaying`), so `playedAt` is null there.
 * @param {unknown} payload — parsed user.getrecenttracks response
 */
export function normalizeTracks(payload) {
	const tracks = payload?.recenttracks?.track;
	if (!Array.isArray(tracks)) {
		throw new Error('Last.fm response missing recenttracks.track');
	}

	return tracks.slice(0, TRACK_LIMIT).map((track) => {
		const uts = Number(track?.date?.uts);
		return {
			name: str(track?.name),
			artist: str(track?.artist?.['#text']),
			url: str(track?.url),
			image: coverUrl(track?.image),
			nowPlaying: track?.['@attr']?.nowplaying === 'true',
			playedAt: Number.isFinite(uts) && uts > 0 ? uts * 1000 : null
		};
	});
}

/**
 * `takenAtNaive` stays a string: it is the photo site's own timezone-naive
 * capture time, and re-deriving it would move it into the viewer's zone.
 * @param {unknown} payload — parsed photos feed.json
 */
export function normalizePhotos(payload) {
	const photos = payload?.photos;
	if (!Array.isArray(photos)) {
		throw new Error('Photos feed missing photos array');
	}

	return photos.slice(0, PHOTO_LIMIT).map((photo) => ({
		id: str(photo?.id),
		title: str(photo?.title),
		url: str(photo?.url),
		image: str(photo?.src?.medium?.url) || str(photo?.src?.large?.url),
		takenAt: str(photo?.takenAtNaive)
	}));
}

/**
 * Whether a freshly-fetched feed matches the stored one. An unchanged feed must
 * not be written: Convex invalidates on the document, so re-patching an
 * identical row pushed a websocket update to every open home page 288 times a
 * day per feed to say nothing had happened.
 *
 * @param {Array<Record<string, unknown>> | undefined} stored
 * @param {Array<Record<string, unknown>>} fetched
 */
export function sameFeedRows(stored, fetched) {
	if (!Array.isArray(stored) || stored.length !== fetched.length) return false;

	for (let i = 0; i < fetched.length; i++) {
		const before = stored[i];
		const after = fetched[i];
		if (!before) return false;
		for (const key of Object.keys(after)) {
			if (before[key] !== after[key]) return false;
		}
	}
	return true;
}
