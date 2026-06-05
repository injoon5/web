/**
 * Rapid up/down votes — counts must stay bounded (0–1 per side for one voter).
 * Usage: node scripts/vote-race-test.mjs [commentId]
 */
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5173';
const PAGE = '/blog/now-listening';

async function req(method, path, body) {
	const res = await fetch(`${BASE}${path}`, {
		method,
		headers: { 'Content-Type': 'application/json' },
		body: body ? JSON.stringify(body) : undefined
	});
	return { status: res.status, json: await res.json().catch(() => null) };
}

async function main() {
	let commentId = process.argv[2];
	if (!commentId) {
		const created = await req('POST', '/api/comments', {
			url: PAGE,
			username: 'race',
			password: 'test1234',
			text: `race ${Date.now()}`
		});
		commentId = created.json?.comment?.id;
		if (!commentId) {
			console.error('create failed', created);
			process.exit(1);
		}
	}

	const votes = [];
	for (let i = 0; i < 20; i++) {
		votes.push(
			req('POST', `/api/comments/${commentId}/vote`, {
				voteType: i % 2 === 0 ? 'up' : 'down'
			})
		);
	}
	const results = await Promise.all(votes);

	const list = await req('GET', `/api/comments?url=${encodeURIComponent(PAGE)}`);
	const c = list.json?.comments?.find((x) => x.id === commentId);
	console.log('comment', {
		upvotes: c?.upvotes,
		downvotes: c?.downvotes,
		score: c?.score,
		myVote: c?.myVote
	});

	const bad = results.some(
		(r) =>
			r.json?.upvotes > 1 || r.json?.downvotes > 1 || r.json?.upvotes < 0 || r.json?.downvotes < 0
	);
	const finalBad = c && (c.upvotes > 1 || c.downvotes > 1 || c.upvotes < 0 || c.downvotes < 0);

	if (bad || finalBad) {
		console.error('FAIL: inflated or negative counts');
		process.exit(1);
	}
	console.log('vote-race-test: ok (20 parallel toggles)');
}

main();
