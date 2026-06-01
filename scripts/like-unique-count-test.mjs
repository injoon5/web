/**
 * Parallel like POSTs for one visitor must not inflate the public count.
 * Usage: node scripts/like-unique-count-test.mjs
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
	const before = await req('GET', `/api/likes?url=${encodeURIComponent(PAGE)}`);
	const startCount = before.json?.count ?? 0;

	const toggles = [];
	for (let i = 0; i < 12; i++) {
		toggles.push(req('POST', '/api/likes', { url: PAGE, liked: i % 2 === 0 }));
	}
	await Promise.all(toggles);

	const after = await req('GET', `/api/likes?url=${encodeURIComponent(PAGE)}`);
	const endCount = after.json?.count ?? 0;
	const delta = Math.abs(endCount - startCount);

	// One visitor cannot move the global count by more than one like.
	if (delta > 1) {
		console.error('FAIL: count moved by', delta, { startCount, endCount });
		process.exit(1);
	}

	console.log('like-unique-count-test: ok', { startCount, endCount, liked: after.json?.liked });
}

main();
