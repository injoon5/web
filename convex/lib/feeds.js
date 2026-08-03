/**
 * Pure helpers for the two home-page feeds (no `ctx`, no `Date.now()`), so the
 * upstream-shape wrangling is unit-testable without a deployment.
 *
 * Both feeds are normalized at write time rather than stored raw. The page only
 * ever renders a cover, a title, a link and a timestamp, and the raw payloads
 * are ~20x that — Last.fm alone ships four image sizes and two mbids per track.
 * Normalizing here keeps the row small and keeps `#text`/`@attr` keys out of
 * the schema.
 */

/** Last.fm account the recent-tracks feed is read for. */
export const LASTFM_USER = 'injoon5';

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
 * Last.fm returns four image sizes per track, ordered small → extralarge. The
 * page renders a 192px cover, so 'large' (174px) is the closest fit; fall back
 * to whichever entry has a URL if the ordering ever changes.
 *
 * @param {unknown} images
 */
function coverUrl(images) {
	if (!Array.isArray(images)) return '';
	const large = images.find((image) => image?.size === 'large');
	const withUrl = images.find((image) => str(image?.['#text']));
	return str(large?.['#text']) || str(withUrl?.['#text']);
}

/**
 * `date` is absent on the currently-playing track — Last.fm marks that one with
 * `@attr.nowplaying` instead — so `playedAt` is null there and the page skips it
 * when it labels the last scrobble.
 *
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
 * `takenAtNaive` stays a string: it's the photo site's own already-formatted,
 * timezone-naive capture time ('09 May 2026 7:50PM'), and re-deriving it from an
 * instant would move it into the viewer's zone.
 *
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
 * Whether a freshly-fetched feed list matches the one already stored.
 *
 * The crons run every five minutes; the feeds change far less often than that.
 * Writing an identical row anyway still changes the document (`updatedAt` moves
 * if nothing else), and Convex invalidates on the document — so every open home
 * page took a websocket push 288 times a day per feed to be told nothing had
 * happened. Both lists are short, flat and same-shaped, so this comparison is
 * cheap enough to run before every write.
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
