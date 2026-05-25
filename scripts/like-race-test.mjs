/**
 * Parallel like toggles must not inflate count above 1 per visitor.
 * Usage: node scripts/like-race-test.mjs [url]
 */
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5173';
const PAGE = process.argv[2] ?? '/blog/now-listening';

async function req(method, path, body) {
	const res = await fetch(`${BASE}${path}`, {
		method,
		headers: { 'Content-Type': 'application/json' },
		body: body ? JSON.stringify(body) : undefined
	});
	return { status: res.status, json: await res.json().catch(() => null) };
}

async function main() {
	const before = await req('GET', `/api/likes?url=${encodeURIComponent(PAGE)}`);
	const startCount = before.json?.count ?? 0;

	const toggles = [];
	for (let i = 0; i < 10; i++) {
		toggles.push(req('POST', '/api/likes', { url: PAGE }));
	}
	await Promise.all(toggles);

	const after = await req('GET', `/api/likes?url=${encodeURIComponent(PAGE)}`);
	const endCount = after.json?.count ?? 0;
	const delta = endCount - startCount;

	console.log('page', PAGE, { startCount, endCount, delta, liked: after.json?.liked });

	// Even number of parallel toggles from cold should land at +0 or +1, never +2+
	if (delta > 1) {
		console.error('FAIL: like count jumped by more than 1');
		process.exit(1);
	}

	console.log('like-race-test: ok (10 parallel toggles)');
}

main();
