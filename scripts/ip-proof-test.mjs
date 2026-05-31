/**
 * Verifies Convex write mutations reject forged ipHash (no valid ipProof).
 * Usage: PUBLIC_CONVEX_URL=... node scripts/ip-proof-test.mjs
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
	console.error('Set PUBLIC_CONVEX_URL in .env');
	process.exit(1);
}

const client = new ConvexHttpClient(url);

async function main() {
	const mod = await import('../convex/_generated/api.js');
	const { api } = mod;

	try {
		await client.mutation(api.likes.setLike, {
			url: '/blog/now-listening',
			ipHash: 'forged-ip-hash',
			ipProof: 'deadbeef',
			liked: true
		});
		console.error('FAIL: mutation accepted forged ipHash');
		process.exit(1);
	} catch (err) {
		const msg = err.message ?? String(err);
		if (!/forbidden|invalid/i.test(msg)) {
			console.error('FAIL: unexpected error:', msg);
			process.exit(1);
		}
	}

	console.log('ip-proof-test: ok (forged write rejected)');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
