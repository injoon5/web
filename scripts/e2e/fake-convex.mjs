/**
 * A stand-in for the Convex HTTP API, for the e2e run. It answers the queries
 * the server renders with fixed data, and checks that every write keyed on an
 * `ipHash` carries the server credential (convex/lib/serverCall.js) — so the
 * run proves the SvelteKit routes send it, not just that a mock was called.
 *
 * The websocket client cannot connect to it; live subscriptions stay on their
 * initial data, which is what the pages render from anyway.
 */
import { createServer } from 'node:http';
import { SERVER_CALL_FUNCTIONS, deriveServerCredential } from '../../convex/lib/serverCall.js';

const GATED = new Set(SERVER_CALL_FUNCTIONS);

const VALUES = {
	'feeds:nowPlaying': {
		tracks: [
			{
				name: 'Track One',
				artist: 'Artist',
				url: 'https://example.com/1',
				// The host Last.fm really serves covers from: a CSP that lists the
				// wrong one blocked every cover, and this run could not see it.
				image: 'https://lastfm-img.freetls.fastly.net/i/u/174s/a.jpg',
				nowPlaying: true,
				playedAt: null
			}
		],
		updatedAt: 1
	},
	'feeds:photos': {
		photos: [
			{
				id: 'p1',
				title: 'Photo One',
				url: 'https://photos.injoon5.com/p1',
				image: 'https://photos.injoon5.com/p1.jpg',
				takenAt: '2026-10-01 10:00'
			}
		],
		updatedAt: 1
	},
	'now:get': { content: 'Reading **papers**.\n\n- one\n- two', updatedAt: 1793800000000 },
	'likes:get': { count: 3, liked: false },
	'likes:setLike': { count: 4, liked: true },
	'comments:list': { page: [], isDone: true, continueCursor: '' },
	'comments:checkCanCreate': null,
	'comments:create': { id: 'k57abc', url: '/blog/us-camp', text: 't', upvotes: 0, downvotes: 0 },
	'comments:vote': { upvotes: 1, downvotes: 0, myVote: 'up' },
	'commentActions:editComment': { success: true },
	'commentActions:softDeleteComment': { success: true }
};

/**
 * @param {{ port: number, adminSecret: string }} options
 * @returns {Promise<{ calls: { path: string, credential: string }[], close: () => void }>}
 */
export async function startFakeConvex({ port, adminSecret }) {
	const expected = await deriveServerCredential(adminSecret);
	/** @type {{ path: string, credential: string }[]} */
	const calls = [];

	const server = createServer((req, res) => {
		let body = '';
		req.on('data', (chunk) => (body += chunk));
		req.on('end', () => {
			let path = '';
			/** @type {Record<string, unknown>} */
			let args = {};
			try {
				const parsed = JSON.parse(body || '{}');
				path = parsed.path ?? '';
				args = (Array.isArray(parsed.args) ? parsed.args[0] : parsed.args) ?? {};
			} catch {
				// Not a function call (the websocket's sync endpoint): answer empty.
			}
			const gated = GATED.has(path);
			const credential = !gated
				? '-'
				: args.serverCredential === expected
					? 'valid'
					: args.serverCredential
						? 'wrong'
						: 'missing';
			if (path) calls.push({ path, credential });

			const ok = !gated || credential === 'valid';
			res.writeHead(200, { 'content-type': 'application/json' });
			res.end(
				JSON.stringify(
					ok
						? { status: 'success', value: VALUES[path] ?? null, logLines: [] }
						: { status: 'error', errorMessage: 'Unauthorized', errorData: { kind: 'Unauthorized' } }
				)
			);
		});
	});

	return new Promise((resolve) =>
		server.listen(port, '127.0.0.1', () => resolve({ calls, close: () => server.close() }))
	);
}
