/**
 * Integration smoke test against a live Convex deployment.
 * Usage: PUBLIC_CONVEX_URL=https://....convex.cloud node scripts/integration-test.mjs
 */
import { readFileSync } from 'node:fs';
import { ConvexHttpClient } from 'convex/browser';

function loadEnv() {
	const text = readFileSync('.env', 'utf8');
	for (const line of text.split('\n')) {
		const m = /^([^#=]+)=(.*)$/.exec(line.trim());
		if (m && process.env[m[1].trim()] === undefined) {
			process.env[m[1].trim()] = m[2].trim();
		}
	}
}

loadEnv();

const url = process.env.PUBLIC_CONVEX_URL;
if (!url || url.includes('your-deployment')) {
	console.error('Set PUBLIC_CONVEX_URL in .env to a real deployment');
	process.exit(1);
}

const client = new ConvexHttpClient(url);

async function runQuery(path, args) {
	const mod = await import('../convex/_generated/api.js');
	const parts = path.split('.');
	let ref = mod.api;
	for (const p of parts) ref = ref[p];
	return client.query(ref, args);
}

async function runMutation(path, args) {
	const mod = await import('../convex/_generated/api.js');
	const parts = path.split('.');
	let ref = mod.api;
	for (const p of parts) ref = ref[p];
	return client.mutation(ref, args);
}

async function main() {
	console.log('Convex URL:', url);

	const now = await runQuery('now.get', {});
	console.log('now.get:', now ? 'ok (has doc)' : 'ok (empty)');

	const likes = await runQuery('likes.get', { url: '/blog/now-listening', ipHash: 'test-ip-hash' });
	console.log('likes.get:', { count: likes.count, liked: likes.liked });

	const comments = await runQuery('comments.list', {
		url: '/blog/now-listening',
		ipHash: 'test-ip-hash'
	});
	console.log(
		'comments.list:',
		Array.isArray(comments) ? `${comments.length} comments` : 'unexpected'
	);

	const adminSecret = process.env.ADMIN_SECRET;
	if (adminSecret && !adminSecret.includes('your-secure')) {
		try {
			const urls = await runQuery('admin.listUrls', { adminSecret });
			console.log('admin.listUrls:', `${urls.length} urls`);
		} catch (err) {
			console.log(
				'admin.listUrls: failed (wrong ADMIN_SECRET for deployment?)',
				err.message?.slice(0, 80)
			);
		}
	} else {
		console.log('admin.listUrls: skipped (placeholder ADMIN_SECRET)');
	}

	console.log('integration-test: done');
}

main().catch((err) => {
	console.error('integration-test failed:', err.message || err);
	process.exit(1);
});
